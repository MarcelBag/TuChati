# ================================================================
# backend/apps/chat/consumers.py
# Stable WebSocket consumer
# - history (safe-serialized)
# - text messages
# - typing / presence / delivery
# - reaction passthrough (no DB persistence)
# ================================================================
import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.chat.models import ChatRoom, Message, SystemMessage
from apps.accounts.models import DeviceSession

User = get_user_model()


def _user_display(u: User) -> str:
    full = getattr(u, "get_full_name", lambda: "")()
    return full or u.username


def _msg_to_dict(m: Message) -> dict:
    """Return a JSON-serializable message dict the frontend expects."""
    return {
        "type": "message",
        "id": str(m.id),
        "sender_id": m.sender_id,
        "sender_name": _user_display(m.sender),
        "content": m.content or "",
        "text": m.content or "",
        "attachment": (m.attachment.url if getattr(m, "attachment", None) else None),
        "audio": (m.audio.url if getattr(m, "audio", None) else None),
        "created_at": m.created_at.isoformat(),
        "reactions": getattr(m, "reactions", {}) or {},
    }


def _sys_to_dict(s: SystemMessage) -> dict:
    return {
        "type": "system_message",
        "id": str(s.id),
        "sender_id": None,
        "sender_name": "system",
        "content": s.content or "",
        "text": s.content or "",
        "attachment": None,
        "audio": None,
        "created_at": s.created_at.isoformat(),
        "reactions": {},
    }


class ChatConsumer(AsyncWebsocketConsumer):
    HEARTBEAT_INTERVAL = 30  # seconds

    async def connect(self):
        """Authenticate, join room, mark online, start heartbeat."""
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.user = self.scope.get("user")
        self.group_name = f"room_{self.room_id}"
        self._heartbeat_task = None

        if not getattr(self.user, "is_authenticated", False):
            await self.close(code=4003)
            return

        await self.accept()
        await self.channel_layer.group_add(f"user_{self.user.id}", self.channel_name)

        if not await self._is_participant(self.user.id, self.room_id):
            await self.send(text_data=json.dumps({
                "type": "error", "message": "Not a participant of this room"
            }))
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self._update_presence(self.user.id, True)
        await self._auto_mark_delivered(self.room_id, self.user.id)

        # Send history safely (no FieldFile objects)
        messages = await self._get_last_messages(self.room_id)
        await self.send(text_data=json.dumps({"type": "history", "messages": messages}))

        # announce online
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence_update",
                "user": self.user.username,
                "status": "online",
                "device": getattr(self.user, "device_type", "web"),
                "last_seen": None,
            },
        )

        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def disconnect(self, code):
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if getattr(self.user, "id", None):
            await self.channel_layer.group_discard(f"user_{self.user.id}", self.channel_name)

        if getattr(self, "user", None) and getattr(self.user, "id", None):
            last_seen = await self._update_presence(self.user.id, False)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "presence_update",
                    "user": self.user.username,
                    "status": "offline",
                    "device": getattr(self.user, "device_type", "web"),
                    "last_seen": last_seen,
                },
            )

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            data = {"type": "message", "content": text_data or ""}

        msg_type = data.get("type", "message")

        # typing indicator
        if msg_type in ["typing", "stopped_typing"]:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user_typing_to_you",
                    "from_user": _user_display(self.user),
                    "typing": (msg_type == "typing"),
                },
            )
            return

        # reaction passthrough
        if msg_type == "reaction":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "reaction_event",
                    "message_id": data.get("message_id"),
                    "emoji": data.get("emoji"),
                    "user_id": self.user.id,
                    "op": "toggle",
                },
            )
            return

        if msg_type == "focus":
            await self._auto_mark_read(self.room_id, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "message_delivery", "status": "read", "user": self.user.username, "ids": []},
            )
            return

        if msg_type == "delivered":
            ids = data.get("ids", [])
            await self._mark_delivered(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "message_delivery", "status": "delivered", "user": self.user.username, "ids": ids},
            )
            return

        if msg_type == "read":
            ids = data.get("ids", [])
            await self._mark_read(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "message_delivery", "status": "read", "user": self.user.username, "ids": ids},
            )
            return

        # text message
        if msg_type == "message":
            content = (data.get("content") or "").strip()
            if not content:
                return
            client_id = data.get("_client_id")
            m = await self._save_message(self.room_id, self.user.id, content)
            payload = _msg_to_dict(m)
            if client_id:
                payload["_client_id"] = client_id  # allow optimistic replacement
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "chat_message", "payload": payload},
            )
            return

        if msg_type == "ping":
            await self.send(text_data=json.dumps({"type": "pong", "ts": timezone.now().isoformat()}))
            return

    # ---------------- heartbeat ----------------
    async def _heartbeat_loop(self):
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)
                await self._update_presence(self.user.id, True)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "presence_update",
                        "user": self.user.username,
                        "status": "online",
                        "device": getattr(self.user, "device_type", "web"),
                        "last_seen": None,
                    },
                )
        except asyncio.CancelledError:
            pass

    # ---------------- event handlers ----------------
    async def chat_message(self, event):
        payload = event.get("payload", {})
        if "type" not in payload:
            payload["type"] = "message"
        await self.send(text_data=json.dumps(payload))

    async def user_typing_to_you(self, event):
        if event["from_user"] != _user_display(self.user):
            await self.send(text_data=json.dumps({
                "type": "typing",
                "from_user": event["from_user"],
                "typing": event["typing"],
                "timestamp": timezone.now().isoformat(),
            }))

    async def reaction_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "reaction",
            "message_id": event.get("message_id"),
            "emoji": event.get("emoji"),
            "user_id": event.get("user_id"),
            "op": event.get("op", "toggle"),
        }))

    async def message_delivery(self, event):
        await self.send(text_data=json.dumps({
            "type": "delivery",
            "status": event["status"],
            "user": event["user"],
            "ids": event["ids"],
        }))

    async def presence_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence",
            "user": event["user"],
            "status": event["status"],
            "device": event.get("device", "web"),
            "last_seen": event["last_seen"],
        }))

    async def chat_system_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "system_message",
            "event": event.get("event"),
            "message": event.get("message"),
            "room_id": event.get("room_id"),
            "invited_users": event.get("invited_users", []),
            "timestamp": str(timezone.now()),
        }))

    async def chat_invitation(self, event):
        await self.send(text_data=json.dumps({
            "type": "invitation",
            "room_id": event.get("room_id"),
            "room_name": event.get("room_name"),
            "invited_by": event.get("invited_by"),
            "message": event.get("message"),
            "timestamp": str(timezone.now()),
        }))

    # ---------------- DB helpers ----------------
    @database_sync_to_async
    def _is_participant(self, user_id, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
            return room.participants.filter(id=user_id).exists()
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def _save_message(self, room_id, user_id, content):
        return Message.objects.create(room_id=room_id, sender_id=user_id, content=content)

    @database_sync_to_async
    def _get_last_messages(self, room_id, limit=50):
        msgs = list(Message.objects.filter(room_id=room_id).select_related("sender").order_by("-created_at")[:limit])
        sys = list(SystemMessage.objects.filter(room_id=room_id).order_by("-created_at")[:limit])

        # serialize and sort by created_at
        payload = [_msg_to_dict(m) for m in msgs] + [_sys_to_dict(s) for s in sys]
        payload.sort(key=lambda x: x["created_at"])
        return payload[-limit:]

    @database_sync_to_async
    def _mark_delivered(self, message_ids, user_id):
        if not message_ids:
            return
        msgs = Message.objects.filter(id__in=message_ids)
        now = timezone.now()
        for msg in msgs:
            msg.delivered_to.add(user_id)
            msg.delivered_at = now
            msg.save(update_fields=["delivered_at"])

    @database_sync_to_async
    def _mark_read(self, message_ids, user_id):
        if not message_ids:
            return
        msgs = Message.objects.filter(id__in=message_ids)
        now = timezone.now()
        for msg in msgs:
            msg.is_read = True
            msg.read_by.add(user_id)
            msg.read_at = now
            msg.save(update_fields=["is_read", "read_at"])

    @database_sync_to_async
    def _auto_mark_delivered(self, room_id, user_id):
        msgs = Message.objects.filter(room_id=room_id).exclude(delivered_to=user_id)
        now = timezone.now()
        for msg in msgs:
            msg.delivered_to.add(user_id)
            msg.delivered_at = now
            msg.save(update_fields=["delivered_at"])

    @database_sync_to_async
    def _auto_mark_read(self, room_id, user_id):
        msgs = Message.objects.filter(room_id=room_id).exclude(read_by=user_id)
        now = timezone.now()
        for msg in msgs:
            msg.is_read = True
            msg.read_by.add(user_id)
            msg.read_at = now
            msg.save(update_fields=["is_read", "read_at"])

    @database_sync_to_async
    def _update_presence(self, user_id, is_online):
        try:
            user = User.objects.get(id=user_id)
            if is_online:
                user.mark_online()
            else:
                user.mark_offline()
            DeviceSession.objects.filter(user_id=user_id, is_active=True).update(
                last_active=timezone.now(),
                connection_status="online" if is_online else "offline",
            )
            return user.last_seen.isoformat() if not is_online else None
        except User.DoesNotExist:
            return None

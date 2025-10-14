# ================================================================
# backend/apps/chat/consumers.py
# Full-featured WebSocket chat consumer (frontend-aligned)
# - Real-time messaging (type: "message")
# - History on connect (type: "history")
# - Typing indicators (type: "typing")
# - Reactions pass-through (type: "reaction")
# - Delivery & Read receipts (type: "delivery")
# - Presence + heartbeat (type: "presence")
# ================================================================
import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.chat.models import ChatRoom, Message
from apps.accounts.models import DeviceSession

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    HEARTBEAT_INTERVAL = 30  # seconds

    async def connect(self):
        """Authenticate, join room, mark online, start heartbeat."""
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.user = self.scope.get("user")
        self.group_name = f"room_{self.room_id}"
        self._heartbeat_task = None

        # Reject unauthenticated users
        if not getattr(self.user, "is_authenticated", False):
            await self.close(code=4003)
            return

        # Accept early to avoid browser auto-close
        await self.accept()
        print(f"[WS] accepted socket for {self.user.username} room={self.room_id}")

        # Join per-user group (personal notifications)
        await self.channel_layer.group_add(f"user_{self.user.id}", self.channel_name)

        # Participant membership check
        if not await self._is_participant(self.user.id, self.room_id):
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Not a participant of this room",
            }))
            await self.close(code=4003)
            return

        # Join room group
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Update presence and mark pending messages delivered
        await self._update_presence(self.user.id, True)
        await self._auto_mark_delivered(self.room_id, self.user.id)

        # Send chat history (normalized for frontend)
        messages = await self._get_last_messages(self.room_id)
        await self.send(text_data=json.dumps({"type": "history", "messages": messages}))

        # Announce online
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

        # Start heartbeat loop
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        print(f"[WS] {self.user.username} joined {self.group_name}")

    async def disconnect(self, code):
        """Handle user disconnect."""
        uname = getattr(self.user, "username", "?")
        print(f"[WS] {uname} disconnected (code={code})")

        # Stop heartbeat
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        # Leave groups
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, "user") and getattr(self.user, "id", None):
            await self.channel_layer.group_discard(f"user_{self.user.id}", self.channel_name)

        # Mark offline & broadcast
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
        """Handle incoming frames from clients."""
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            data = {"type": "message", "content": text_data or ""}

        msg_type = data.get("type", "message")

        # --- Typing indicator (boolean compatible) ---
        if msg_type in ["typing", "stopped_typing"]:
            typing_flag = bool(data.get("typing", msg_type == "typing"))
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user_typing_to_you",
                    "from_user": self.user.username,
                    "typing": typing_flag,
                },
            )
            return

        # --- Focus (mark all read) ---
        if msg_type == "focus":
            await self._auto_mark_read(self.room_id, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "message_delivery", "status": "read", "user": self.user.username, "ids": []},
            )
            return

        # --- Delivered receipts ---
        if msg_type == "delivered":
            ids = data.get("ids", [])
            await self._mark_delivered(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "message_delivery", "status": "delivered", "user": self.user.username, "ids": ids},
            )
            return

        # --- Read receipts ---
        if msg_type == "read":
            ids = data.get("ids", [])
            await self._mark_read(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "message_delivery", "status": "read", "user": self.user.username, "ids": ids},
            )
            return

        # --- Reaction echo (frontend merges) ---
        if msg_type == "reaction":
            payload = {
                "type": "reaction",
                "message_id": data.get("message_id"),
                "emoji": data.get("emoji"),
                "user_id": self.user.id,
                "op": data.get("op", "toggle"),
            }
            await self.channel_layer.group_send(self.group_name, {"type": "chat_reaction", "payload": payload})
            return

        # --- Normal message ---
        if msg_type == "message":
            content = (data.get("content") or "").strip()
            client_id = data.get("_client_id")
            if not content:
                return

            message = await self._save_message(self.room_id, self.user.id, content)
            # Echo to room (include _client_id if one came from the client)
            payload = {
                "type": "message",
                "id": message["id"],
                "_client_id": client_id,
                "sender": {
                    "id": self.user.id,
                    "username": self.user.username,
                    "name": getattr(self.user, "get_full_name", lambda: "")() or self.user.username,
                },
                "content": message["content"],
                "created_at": message["created_at"],
            }
            await self.channel_layer.group_send(self.group_name, {"type": "chat_message", "payload": payload})
            return

        # --- Ping/Pong ---
        if msg_type == "ping":
            await self.send(text_data=json.dumps({"type": "pong", "ts": timezone.now().isoformat()}))
            return

    # ================================================================
    # Heartbeat
    # ================================================================
    async def _heartbeat_loop(self):
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)
                await self._update_presence(self.user.id, True)
                await self.channel_layer.group_send(
                    self.group_name,
                    {"type": "presence_update", "user": self.user.username, "status": "online", "device": "web", "last_seen": None},
                )
        except asyncio.CancelledError:
            pass

    # ================================================================
    # Event handlers (group_send targets)
    # ================================================================
    async def chat_message(self, event):
        payload = event.get("payload", {})
        if "type" not in payload:
            payload["type"] = "message"
        await self.send(text_data=json.dumps(payload))

    async def chat_reaction(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def user_typing_to_you(self, event):
        if event["from_user"] != self.user.username:
            await self.send(text_data=json.dumps({
                "type": "typing",
                "from_user": event["from_user"],
                "typing": event["typing"],
                "timestamp": timezone.now().isoformat(),
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

    # ================================================================
    # DB helpers
    # ================================================================
    @database_sync_to_async
    def _is_participant(self, user_id, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
            return room.participants.filter(id=user_id).exists()
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def _save_message(self, room_id, user_id, content):
        msg = Message.objects.create(room_id=room_id, sender_id=user_id, content=content)
        return {
            "id": str(msg.id),
            "sender": msg.sender.username,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
        }

    @database_sync_to_async
    def _get_last_messages(self, room_id, limit=25):
        from apps.chat.models import SystemMessage
        msgs = Message.objects.filter(room_id=room_id).select_related("sender").order_by("-created_at")[:limit]
        system_msgs = SystemMessage.objects.filter(room_id=room_id).order_by("-created_at")[:limit]

        normal = [{
            "id": str(m.id),
            "type": "message",
            "sender": {
                "id": m.sender_id,
                "username": m.sender.username,
                "name": m.sender.get_full_name() or m.sender.username,
            },
            "content": m.content,
            "attachment": getattr(m, "attachment", None),
            "audio": getattr(m, "audio", None),
            "created_at": m.created_at.isoformat(),
        } for m in msgs]

        sys = [{
            "id": str(s.id),
            "type": "system_message",
            "sender": "system",
            "content": s.content,
            "created_at": s.created_at.isoformat(),
        } for s in system_msgs]

        all_msgs = sorted(normal + sys, key=lambda x: x["created_at"])
        return all_msgs[-limit:]

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

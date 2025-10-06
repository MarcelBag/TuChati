# ================================================================
# backend/apps/chat/consumers.py
# Full-featured WebSocket chat consumer:
# ✅ Real-time messaging
# ✅ Delivery + Read receipts
# ✅ Typing indicators
# ✅ Presence & Last Seen
# ✅ Auto-presence heartbeat (every 30s)
# ================================================================
import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.chat.models import ChatRoom, Message

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    HEARTBEAT_INTERVAL = 30  # seconds

    async def connect(self):
        """Authenticate, join room, mark online, start heartbeat."""
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.user = self.scope.get("user")

        if not getattr(self.user, "is_authenticated", False):
            await self.close(code=4003)
            return

        if not await self._is_participant(self.user.id, self.room_id):
            await self.close(code=4003)
            return

        self.group_name = f"room_{self.room_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Update presence and notify room
        await self._update_presence(self.user.id, True)
        await self._auto_mark_delivered(self.room_id, self.user.id)

        # Send message history
        messages = await self._get_last_messages(self.room_id)
        await self.send(text_data=json.dumps({"type": "history", "messages": messages}))

        # Notify others
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence_update",
                "user": self.user.username,
                "status": "online",
                "last_seen": None,
            },
        )

        # Start background heartbeat task
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def disconnect(self, code):
        """Handle user disconnect."""
        if hasattr(self, "_heartbeat_task"):
            self._heartbeat_task.cancel()

        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        last_seen = await self._update_presence(self.user.id, False)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence_update",
                "user": self.user.username,
                "status": "offline",
                "last_seen": last_seen,
            },
        )

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming client messages and events."""
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            data = {"type": "message", "content": text_data or ""}

        msg_type = data.get("type", "message")

        # --- Typing indicator ---
        if msg_type in ["typing", "stopped_typing"]:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user_typing_to_you",
                    "from_user": self.user.username,
                    "typing": (msg_type == "typing"),
                },
            )
            return

        # --- Focus (user opened chat) ---
        if msg_type == "focus":
            await self._auto_mark_read(self.room_id, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "message_delivery",
                    "status": "read",
                    "user": self.user.username,
                    "ids": [],
                },
            )
            return

        # --- Delivery ---
        if msg_type == "delivered":
            ids = data.get("ids", [])
            await self._mark_delivered(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "message_delivery",
                    "status": "delivered",
                    "user": self.user.username,
                    "ids": ids,
                },
            )
            return

        # --- Read ---
        if msg_type == "read":
            ids = data.get("ids", [])
            await self._mark_read(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "message_delivery",
                    "status": "read",
                    "user": self.user.username,
                    "ids": ids,
                },
            )
            return

        # --- Normal chat message ---
        if msg_type == "message":
            content = data.get("content", "").strip()
            if not content:
                return
            message = await self._save_message(self.room_id, self.user.id, content)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message",
                    "payload": {
                        "id": message["id"],
                        "sender": self.user.username,
                        "content": message["content"],
                        "created_at": message["created_at"],
                    },
                },
            )

    # ================================================================
    # Internal heartbeat task
    # ================================================================
    async def _heartbeat_loop(self):
        """Broadcasts presence every HEARTBEAT_INTERVAL seconds."""
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "presence_update",
                        "user": self.user.username,
                        "status": "online",
                        "last_seen": None,
                    },
                )
                await self._update_presence(self.user.id, True)
        except asyncio.CancelledError:
            pass  # Stop gracefully when socket closes

    # ================================================================
    # Event handlers
    # ================================================================
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def user_typing_to_you(self, event):
        if event["from_user"] != self.user.username:
            await self.send(text_data=json.dumps({
                "type": "typing",
                "from_user": event["from_user"],
                "typing": event["typing"],
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
            "last_seen": event["last_seen"],
        }))

    # ================================================================
    # Database helper methods
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
        msgs = Message.objects.filter(room_id=room_id).order_by("-created_at")[:limit]
        return [
            {
                "id": str(m.id),
                "sender": m.sender.username,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
                "is_read": m.is_read,
                "read_by": [u.username for u in m.read_by.all()],
                "delivered_to": [u.username for u in m.delivered_to.all()],
            }
            for m in reversed(msgs)
        ]

    @database_sync_to_async
    def _mark_delivered(self, message_ids, user_id):
        msgs = Message.objects.filter(id__in=message_ids)
        now = timezone.now()
        for msg in msgs:
            msg.delivered_to.add(user_id)
            msg.delivered_at = now
            msg.save(update_fields=["delivered_at"])

    @database_sync_to_async
    def _mark_read(self, message_ids, user_id):
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
        """Update presence and return formatted last_seen if offline."""
        try:
            user = User.objects.get(id=user_id)
            if is_online:
                user.mark_online()
                return None
            else:
                user.mark_offline()
                return user.last_seen.isoformat()
        except User.DoesNotExist:
            return None

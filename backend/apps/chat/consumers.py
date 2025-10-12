# ================================================================
# backend/apps/chat/consumers.py
# Full-featured WebSocket chat consumer:
# - Real-time messaging
# - Delivery + Read receipts
# - Typing indicators
# - Presence & Last Seen
# - Auto-presence heartbeat (every 30s)
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


def _iso(dt):
    """Return ISO string or None."""
    if not dt:
        return None
    try:
        return dt.isoformat()
    except AttributeError:
        # already a string
        return dt


class ChatConsumer(AsyncWebsocketConsumer):
    HEARTBEAT_INTERVAL = 30  # seconds

    # ------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------
    async def connect(self):
        """Authenticate, join room, mark online, start heartbeat."""
        # Pull route args & user from scope first
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.user = self.scope.get("user")

        # Reject unauthenticated users
        if not getattr(self.user, "is_authenticated", False):
            await self.close(code=4003)
            return

        # Accept the socket immediately to avoid premature closure
        await self.accept()
        print(f"[WS] accepted socket for {self.user.username} room={self.room_id}")

        # Join user-specific group (notifications, invitations, etc.)
        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)

        # Ensure the user belongs to the room
        if not await self._is_participant(self.user.id, self.room_id):
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Not a participant of this room",
            }))
            await self.close(code=4003)
            return

        # Join room broadcast group
        self.group_name = f"room_{self.room_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Mark presence & auto-deliver
        await self._update_presence(self.user.id, True)
        await self._auto_mark_delivered(self.room_id, self.user.id)

        # Send recent history
        messages = await self._get_last_messages(self.room_id)
        await self.send(text_data=json.dumps({"type": "history", "messages": messages}))

        # Notify others that this user is online
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

        # Start background heartbeat
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        print(f"[WS] {self.user.username} joined {self.group_name}")

    async def disconnect(self, code):
        """Handle user disconnect."""
        uname = getattr(self.user, "username", "Unknown")
        print(f"[WS] {uname} disconnected (code={code})")

        if hasattr(self, "_heartbeat_task"):
            self._heartbeat_task.cancel()

        # Leave groups
        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if getattr(self, "user_group", None):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

        # Update presence & broadcast offline
        if getattr(self, "user", None) and getattr(self.user, "is_authenticated", False):
            last_seen = await self._update_presence(self.user.id, False)
            if getattr(self, "group_name", None):
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "presence_update",
                        "user": self.user.username,
                        "status": "offline",
                        "last_seen": last_seen,
                    },
                )

    # ------------------------------------------------------------
    # Incoming messages from client
    # ------------------------------------------------------------
    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages and events from clients."""
        print(f"[WS] RECV from {getattr(self.user, 'username', 'Unknown')}: {text_data}")

        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            data = {"type": "message", "content": text_data or ""}

        msg_type = data.get("type", "message")

        # --- Typing indicator ---
        if msg_type in ("typing", "stopped_typing"):
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

        # --- Delivered receipt ---
        if msg_type == "delivered":
            ids = data.get("ids", [])
            if ids:
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

        # --- Read receipt ---
        if msg_type == "read":
            ids = data.get("ids", [])
            if ids:
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

        # --- Keep-alive ping (optional from client) ---
        if msg_type == "ping":
            await self.send(text_data=json.dumps({"type": "pong", "t": timezone.now().isoformat()}))
            return

        # --- Normal chat message ---
        if msg_type == "message":
            content = (data.get("content") or "").strip()
            if not content:
                return
            message = await self._save_message(self.room_id, self.user.id, content)
            # Broadcast to the room
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message",
                    "payload": {
                        "type": "message",
                        "id": message["id"],
                        "sender": self.user.username,
                        "content": message["content"],
                        "created_at": message["created_at"],
                    },
                },
            )
            return

        # Unknown type -> ignore safely
        print(f"[WS] Unknown msg type from {self.user.username}: {msg_type}")

    # ------------------------------------------------------------
    # Heartbeat
    # ------------------------------------------------------------
    async def _heartbeat_loop(self):
        """Broadcast presence every HEARTBEAT_INTERVAL seconds."""
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)
                # Broadcast via group; do NOT call self.send() here.
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
                # Also update presence in DB
                await self._update_presence(self.user.id, True)
        except asyncio.CancelledError:
            # Task cancelled on disconnect
            pass

    # ------------------------------------------------------------
    # Event handlers (from channel layer)
    # ------------------------------------------------------------
    async def chat_message(self, event):
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
            "ids": event.get("ids", []),
        }))

    async def presence_update(self, event):
        # Normalize last_seen to ISO string if provided
        await self.send(text_data=json.dumps({
            "type": "presence",
            "user": event["user"],
            "status": event["status"],
            "device": event.get("device", "web"),
            "last_seen": _iso(event.get("last_seen")),
        }))

    async def chat_system_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "system_message",
            "event": event.get("event"),
            "message": event.get("message"),
            "room_id": event.get("room_id"),
            "invited_users": event.get("invited_users", []),
            "timestamp": timezone.now().isoformat(),
        }))

    async def chat_invitation(self, event):
        await self.send(text_data=json.dumps({
            "type": "invitation",
            "room_id": event.get("room_id"),
            "room_name": event.get("room_name"),
            "invited_by": event.get("invited_by"),
            "message": event.get("message"),
            "timestamp": timezone.now().isoformat(),
        }))

    # ------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------
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

        msgs = Message.objects.filter(room_id=room_id).order_by("-created_at")[:limit]
        system_msgs = SystemMessage.objects.filter(room_id=room_id).order_by("-created_at")[:limit]

        all_msgs = [
            {
                "id": str(m.id),
                "sender": m.sender.username,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
                "type": "message",
            }
            for m in msgs
        ] + [
            {
                "id": str(s.id),
                "sender": "system",
                "content": s.content,
                "created_at": s.created_at.isoformat(),
                "type": "system_message",
            }
            for s in system_msgs
        ]
        all_msgs.sort(key=lambda x: x["created_at"])
        return all_msgs[-limit:]

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
        """Update presence for user and their active device session."""
        try:
            user = User.objects.get(id=user_id)

            # Update general presence
            if is_online:
                user.mark_online()
            else:
                user.mark_offline()

            # Update device session status
            DeviceSession.objects.filter(
                user_id=user_id, is_active=True
            ).update(
                last_active=timezone.now(),
                connection_status="online" if is_online else "offline",
            )

            return user.last_seen.isoformat() if not is_online else None
        except User.DoesNotExist:
            return None

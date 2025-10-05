# ================================================================
# backend/apps/chat/consumers.py
# Real-time WebSocket consumer with delivery + read receipts
# ================================================================
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from apps.chat.models import ChatRoom, Message
import json

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
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

        # Send message history
        messages = await self._get_last_messages(self.room_id)
        await self.send(text_data=json.dumps({"type": "history", "messages": messages}))

        # Notify others this user joined
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "user.joined", "user": self.user.username},
        )

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """Handle any incoming client messages."""
        data = {}
        if text_data:
            try:
                data = json.loads(text_data)
            except json.JSONDecodeError:
                data = {"type": "message", "content": text_data.strip()}
        else:
            data = {"type": "message", "content": ""}

        msg_type = data.get("type", "message")

        # Unauthenticated users are ignored
        if not getattr(self.user, "is_authenticated", False):
            return

        # --- Typing indicator ---
        if msg_type == "typing":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user.typing",
                    "user": self.user.username,
                    "typing": data.get("typing", False),
                },
            )
            return

        # --- Mark message as delivered ---
        if msg_type == "delivered":
            ids = data.get("ids", [])
            await self._mark_delivered(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "message.delivery",
                    "status": "delivered",
                    "user": self.user.username,
                    "ids": ids,
                },
            )
            return

        # --- Mark message as read ---
        if msg_type == "read":
            ids = data.get("ids", [])
            await self._mark_read(ids, self.user.id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "message.delivery",
                    "status": "read",
                    "user": self.user.username,
                    "ids": ids,
                },
            )
            return

        # --- Regular chat message ---
        content = data.get("content", "").strip()
        if not content:
            return

        # Save message
        message = await self._save_message(self.room_id, self.user.id, content)

        # Broadcast new message
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.message",
                "payload": {
                    "id": message["id"],
                    "sender": self.user.username,
                    "content": content,
                    "created_at": message["created_at"],
                },
            },
        )

    # --- WebSocket Event Handlers ---
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def user_joined(self, event):
        await self.send(text_data=json.dumps({"type": "join", "user": event["user"]}))

    async def user_typing(self, event):
        await self.send(text_data=json.dumps(event))

    async def message_delivery(self, event):
        """Broadcast delivery/read updates to all participants."""
        await self.send(text_data=json.dumps({
            "type": "delivery",
            "status": event["status"],
            "user": event["user"],
            "ids": event["ids"],
        }))

    # --- Database helpers ---
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
    def _get_last_messages(self, room_id, limit=20):
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
        for msg in msgs:
            msg.delivered_to.add(user_id)

    @database_sync_to_async
    def _mark_read(self, message_ids, user_id):
        msgs = Message.objects.filter(id__in=message_ids)
        for msg in msgs:
            msg.is_read = True
            msg.read_by.add(user_id)
            msg.save()

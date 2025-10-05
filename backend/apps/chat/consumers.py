# ================================================================
# backend/apps/chat/consumers.py
# Real-time WebSocket consumer with read/delivery indicators
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
        await self.send(text_data=json.dumps({
            "type": "history",
            "messages": messages
        }))

        # Notify presence
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "user.joined", "user": self.user.username},
        )

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # Safely parse JSON or fallback to plain message
        data = {}
        if text_data:
            try:
                data = json.loads(text_data)
            except json.JSONDecodeError:
                data = {"type": "message", "content": text_data.strip()}
        else:
            data = {"type": "message", "content": ""}

        msg_type = data.get("type", "message")

        if not getattr(self.user, "is_authenticated", False):
            return

        # Handle typing indicator
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

        # Handle normal chat messages
        content = data.get("content", "").strip()
        if not content:
            return

        # Persist message
        message = await self._save_message(self.room_id, self.user.id, content)

        # Broadcast to group
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.message",
                "payload": {
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
        await self.send(text_data=json.dumps({
            "type": "join",
            "user": event["user"]
        }))

    async def user_typing(self, event):
        await self.send(text_data=json.dumps(event))

    async def message_delivery(self, event):
        await self.send(text_data=json.dumps({
            "type": "delivery",
            "status": event["status"],
            "user": event["user"],
            "ids": event["ids"]
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
            } for m in reversed(msgs)
        ]

    @database_sync_to_async
    def _mark_read(self, message_ids, user_id):
        Message.objects.filter(id__in=message_ids).update(is_read=True)
        for msg in Message.objects.filter(id__in=message_ids):
            msg.read_by.add(user_id)

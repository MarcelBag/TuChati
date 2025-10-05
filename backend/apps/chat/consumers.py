# backend/apps/chat/consumers.py
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message

User = get_user_model()


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for real-time chat.
    Path: ws://.../ws/chat/<room_uuid>/
    """

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"chat_{self.room_id}"

        user = self.scope.get("user", AnonymousUser())
        has_access = await self.user_has_access(user, self.room_id)
        if not user.is_authenticated or not has_access:
            await self.close(code=4403)  # forbidden
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """
        Expected messages:
        {
          "type": "message",
          "content": "Hello world"
        }
        """
        user = self.scope.get("user", AnonymousUser())
        if not user.is_authenticated:
            return

        msg_type = content.get("type")
        if msg_type == "message":
            text = content.get("content", "").strip()
            if not text:
                return
            message = await self.create_message(self.room_id, user.id, text)
            payload = {
                "type": "broadcast.message",
                "message": {
                    "id": str(message.id),
                    "room": str(message.room_id),
                    "sender": {"id": user.id, "email": user.email, "username": user.username},
                    "content": message.content,
                    "is_read": message.is_read,
                    "created_at": message.created_at.isoformat(),
                },
            }
            await self.channel_layer.group_send(self.group_name, payload)

    async def broadcast_message(self, event):
        await self.send_json(event["message"])

    # ---- helpers ----
    @database_sync_to_async
    def user_has_access(self, user, room_id):
        if not user or not user.is_authenticated:
            return False
        return ChatRoom.objects.filter(id=room_id, participants=user).exists()

    @database_sync_to_async
    def create_message(self, room_id, user_id, content):
        return Message.objects.create(room_id=room_id, sender_id=user_id, content=content)
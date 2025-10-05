import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from apps.chat.models import ChatRoom, Message

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close(code=4003)
            return

        # Verify participant membership
        is_member = await self._is_participant(self.user.id, self.room_id)
        if not is_member:
            await self.close(code=4003)
            return

        self.group_name = f"room_{self.room_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # (optional) Notify others that a user connected
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user.join",
                "payload": {"user": self.user.username},
            },
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user.leave",
                    "payload": {"user": self.user.username},
                },
            )

    async def receive(self, text_data=None, bytes_data=None):
        """
        Handle incoming WebSocket events. Two types:
        - message: a chat message
        - typing: typing indicators
        """
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            return

        event_type = data.get("type", "message")
        content = data.get("content", "")

        # Handle typing indicator
        if event_type == "typing":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user.typing",
                    "payload": {
                        "user": self.user.username,
                        "typing": data.get("typing", True),
                    },
                },
            )
            return

        # Handle normal chat message
        if event_type == "message" and content:
            # Save to database
            msg = await self._create_message(self.user.id, self.room_id, content)
            # Broadcast to everyone in the room
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat.message",
                    "payload": {
                        "id": str(msg["id"]),
                        "sender": msg["sender"],
                        "content": msg["content"],
                        "created_at": msg["created_at"],
                    },
                },
            )

    # ---------- group event handlers ----------

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            **event["payload"],
        }))

    async def user_typing(self, event):
        await self.send(text_data=json.dumps({
            "type": "typing",
            **event["payload"],
        }))

    async def user_join(self, event):
        await self.send(text_data=json.dumps({
            "type": "join",
            **event["payload"],
        }))

    async def user_leave(self, event):
        await self.send(text_data=json.dumps({
            "type": "leave",
            **event["payload"],
        }))

    # ---------- helpers ----------

    @database_sync_to_async
    def _is_participant(self, user_id, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
            return room.participants.filter(id=user_id).exists()
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def _create_message(self, user_id, room_id, content):
        """Save message in the DB and return serialized data."""
        user = User.objects.get(id=user_id)
        room = ChatRoom.objects.get(id=room_id)
        msg = Message.objects.create(room=room, sender=user, content=content)
        return {
            "id": msg.id,
            "sender": user.username,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
        }

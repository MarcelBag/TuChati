# backend/apps/chat/consumers.py
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from apps.chat.models import ChatRoom
import json

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # MUST match kwarg name in routing.py
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]

        user = self.scope.get("user")
        is_auth = getattr(user, "is_authenticated", False)

        # Debug: leave while you test
        print(f"[WS] connect user={getattr(user, 'username', None)} "
              f"auth={is_auth} room_id={self.room_id}")

        if not is_auth:
            await self.close(code=4003)  # 403 equivalent for WS
            return

        # OPTIONAL: enforce membership
        if not await self._is_participant(user_id=user.id, room_id=self.room_id):
            print("[WS] user not a participant -> closing")
            await self.close(code=4003)
            return

        self.group_name = f"room_{self.room_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except Exception:
            data = {"type": "message", "content": text_data}

        content = data.get("content", "")
        sender = self.scope.get("user")
        if not content or not getattr(sender, "is_authenticated", False):
            return

        # (optional) persist message to DB, then broadcast
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.message",
                "payload": {
                    "sender": sender.username,
                    "content": content,
                },
            },
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    # ---------- helpers ----------
    @database_sync_to_async
    def _is_participant(self, user_id, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
        except ChatRoom.DoesNotExist:
            return False
        return room.participants.filter(id=user_id).exists()

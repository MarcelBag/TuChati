# ================================================================
# backend/apps/chat/consumers.py
# Chat WebSocket consumer for real-time messaging
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from apps.chat.models import ChatRoom, Message
import json
from datetime import datetime

User = get_user_model()
# =====================
# ChatConsumer
# =====================

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        user = self.scope.get("user")
        is_auth = getattr(user, "is_authenticated", False)
        print(f"[WS] connect user={getattr(user, 'username', None)} auth={is_auth} room_id={self.room_id}")

        if not is_auth:
            await self.close(code=4003)
            return

        if not await self._is_participant(user_id=user.id, room_id=self.room_id):
            print("[WS] user not a participant -> closing")
            await self.close(code=4003)
            return

        self.group_name = f"room_{self.room_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send last 20 messages
        last_messages = await self._get_last_messages(self.room_id)
        await self.send(text_data=json.dumps({
            "type": "history",
            "messages": last_messages
        }))

        # Notify others user joined
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "user.joined", "user": user.username},
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except Exception:
            data = {"type": "message", "content": text_data}

        msg_type = data.get("type", "message")
        sender = self.scope.get("user")

        if not getattr(sender, "is_authenticated", False):
            return

        if msg_type == "typing":
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "user.typing", "user": sender.username, "typing": data.get("typing", False)},
            )
            return

        content = data.get("content", "").strip()
        if not content:
            return

        # Persist message
        message = await self._save_message(self.room_id, sender.id, content)

        # Broadcast to group
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.message",
                "payload": {
                    "sender": sender.username,
                    "content": content,
                    "created_at": message["created_at"],
                },
            },
        )

    # --- Event handlers ---
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def user_joined(self, event):
        await self.send(text_data=json.dumps({
            "type": "join",
            "user": event["user"]
        }))

    async def user_typing(self, event):
        await self.send(text_data=json.dumps({
            "type": "typing",
            "user": event["user"],
            "typing": event["typing"],
        }))

    # --- DB helpers ---
    @database_sync_to_async
    def _is_participant(self, user_id, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id)
        except ChatRoom.DoesNotExist:
            return False
        return room.participants.filter(id=user_id).exists()

    @database_sync_to_async
    def _save_message(self, room_id, user_id, content):
        msg = Message.objects.create(
            room_id=room_id,
            sender_id=user_id,
            content=content
        )
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
            }
            for m in reversed(msgs)
        ]

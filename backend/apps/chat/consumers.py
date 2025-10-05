# ================================================================
# backend/apps/chat/consumers.py
# Chat WebSocket consumer for real-time messaging + presence
# ================================================================
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from apps.chat.models import ChatRoom, Message
from django.utils import timezone
import json

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.user = self.scope.get("user")
        is_auth = getattr(self.user, "is_authenticated", False)

        print(f"[WS] connect user={getattr(self.user, 'username', None)} auth={is_auth} room_id={self.room_id}")

        if not is_auth:
            await self.close(code=4003)
            return

        if not await self._is_participant(self.user.id, self.room_id):
            print("[WS] user not a participant -> closing")
            await self.close(code=4003)
            return

        self.group_name = f"room_{self.room_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Mark user online
        await self._set_user_online(self.user.id, True)

        # Send recent messages
        last_messages = await self._get_last_messages(self.room_id)
        await self.send(text_data=json.dumps({
            "type": "history",
            "messages": last_messages
        }))

        # Notify all clients user joined / online
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user.status",
                "user": self.user.username,
                "is_online": True,
            },
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        # Mark user offline and set last_seen
        if getattr(self, "user", None) and getattr(self.user, "is_authenticated", False):
            await self._set_user_online(self.user.id, False)
            await self._update_last_seen(self.user.id)

            # Broadcast offline status
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user.status",
                    "user": self.user.username,
                    "is_online": False,
                },
            )

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except Exception:
            data = {"type": "message", "content": text_data}

        msg_type = data.get("type", "message")

        if not getattr(self.user, "is_authenticated", False):
            return

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

    # --- Event handlers ---
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def user_status(self, event):
        await self.send(text_data=json.dumps({
            "type": "status",
            "user": event["user"],
            "is_online": event["is_online"],
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
            }
            for m in reversed(msgs)
        ]

    @database_sync_to_async
    def _set_user_online(self, user_id, is_online):
        User.objects.filter(id=user_id).update(is_online=is_online)

    @database_sync_to_async
    def _update_last_seen(self, user_id):
        User.objects.filter(id=user_id).update(last_seen=timezone.now())

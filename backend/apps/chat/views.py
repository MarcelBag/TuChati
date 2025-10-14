# ============================================================
# backend/apps/chat/views.py
# ============================================================
# TuChati Chat API Views (frontend-aligned)
# ============================================================
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .consumers import _msg_to_dict

from .models import ChatRoom, Message, SystemMessage
from .serializers import ChatRoomSerializer, MessageSerializer
from .utils import get_or_create_direct_room

User = get_user_model()


class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # light prefetch to reduce N+1
        return (
            ChatRoom.objects.filter(participants=self.request.user)
            .distinct()
            .prefetch_related("participants", "admins")
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        room = serializer.save()
        room.participants.add(self.request.user)
        room.admins.add(self.request.user)
        return room

    @action(detail=False, methods=["post"])
    def create_room(self, request):
        name = request.data.get("name")
        is_group = request.data.get("is_group", False)
        if not name:
            return Response({"error": "Room name required"}, status=400)
        room = ChatRoom.objects.create(name=name, is_group=is_group)
        room.participants.add(request.user)
        room.admins.add(request.user)
        return Response(self.get_serializer(room).data, status=201)

    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, pk=None):
        room = self.get_object()

        if not room.participants.filter(id=request.user.id).exists():
            raise PermissionDenied("You must be a participant to invite others.")

        usernames = request.data.get("usernames", []) or []
        emails = request.data.get("emails", []) or []

        added_users = []
        added_instances = []

        # Find & add by username
        for username in usernames:
            try:
                u = User.objects.get(username=username)
            except User.DoesNotExist:
                continue
            room.participants.add(u)
            added_users.append(u.username)
            added_instances.append(u)

        # Find & add by email
        for email in emails:
            try:
                u = User.objects.get(email=email)
            except User.DoesNotExist:
                continue
            room.participants.add(u)
            added_users.append(u.username)
            added_instances.append(u)

        room.save()

        channel_layer = get_channel_layer()  # define once

        if added_users:
            msg_text = f"{request.user.username} added {', '.join(added_users)} to the chat."
            SystemMessage.objects.create(room=room, content=msg_text)

            # Send to the room group (match ChatConsumer group name!)
            async_to_sync(channel_layer.group_send)(
                f"room_{room.id}",
                {
                    "type": "chat_system_message",  # will call chat_system_message()
                    "event": "user_invited",
                    "message": msg_text,
                    "room_id": str(room.id),
                    "invited_users": added_users,
                },
            )

        # Notify each invited user via their personal group
        for u in added_instances:
            async_to_sync(channel_layer.group_send)(
                f"user_{u.id}",
                {
                    "type": "chat_invitation",  # will call chat_invitation()
                    "room_id": str(room.id),
                    "room_name": room.name,
                    "invited_by": request.user.username,
                    "message": f"You’ve been added to the chat {room.name or room.id}",
                },
            )

        return Response(
            {"room": str(room.id), "invited": added_users, "message": f"Added {len(added_users)} user(s) to this room."},
            status=200,
        )

class MessageListCreateViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        room_id = self.kwargs.get("room_id")
        room = ChatRoom.objects.filter(id=room_id, participants=self.request.user).first()
        if not room:
            raise PermissionDenied("You are not a participant of this room.")
        return Message.objects.filter(room=room).select_related("sender")

    def perform_create(self, serializer):
        room_id = self.kwargs.get("room_id")
        room = ChatRoom.objects.filter(id=room_id, participants=self.request.user).first()
        if not room:
            raise PermissionDenied("You are not a participant of this room.")
        # save
        message: Message = serializer.save(room=room, sender=self.request.user)

        # broadcast to WS listeners so other clients see uploads/voice notes instantly
        channel_layer = get_channel_layer()
        payload = _msg_to_dict(message)
        async_to_sync(channel_layer.group_send)(
            f"room_{room.id}",
            {"type": "chat_message", "payload": payload},
        )
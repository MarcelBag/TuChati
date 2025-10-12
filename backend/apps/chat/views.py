# ============================================================
# backend/apps/chat/views.py
# TuChati Chat API Views
# ============================================================
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer
from django.contrib.auth import get_user_model

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import SystemMessage

# defining user to use our invite method
User = get_user_model()

# ============================================================
# ChatRoom ViewSet (List, Create, Retrieve, Update, Delete)
# ============================================================
class ChatRoomViewSet(viewsets.ModelViewSet):
    """
    Handles:
      - GET /api/chat/rooms/         → list user’s rooms
      - POST /api/chat/rooms/        → create new room
      - GET /api/chat/rooms/<id>/    → retrieve room
      - PUT /api/chat/rooms/<id>/    → update room
      - DELETE /api/chat/rooms/<id>/ → delete room
    """
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatRoom.objects.filter(participants=self.request.user).distinct()

    def perform_create(self, serializer):
        room = serializer.save()
        room.participants.add(self.request.user)
        room.admins.add(self.request.user)
        return room

    @action(detail=False, methods=["post"])
    def create_room(self, request):
        """Custom create group or direct chat"""
        name = request.data.get("name")
        is_group = request.data.get("is_group", False)
        if not name:
            return Response({"error": "Room name required"}, status=400)

        room = ChatRoom.objects.create(name=name, is_group=is_group)
        room.participants.add(request.user)
        room.admins.add(request.user)
        serializer = self.get_serializer(room)
        return Response(serializer.data, status=201)

    # Inviting users to roomchat and adding a real-time system notification
    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, pk=None):
        """
        Invite one or more users to a chatroom by username or email.
        When inviting we will fetch data as follow :
          {
            "usernames": ["nyenye", "mary"],
            "emails": ["user@tuunganes.com"]
          }
        """
        room = self.get_object()

        # Only allow existing participants or admins to invite in that group
        if not room.participants.filter(id=request.user.id).exists():
            raise PermissionDenied("You must be a participant to invite others.")

        usernames = request.data.get("usernames", [])
        emails = request.data.get("emails", [])
        added_users = []
        added_instances = []

        # Fetch by username or email
        for username in usernames:
            try:
                user = User.objects.get(username=username)
                room.participants.add(user)
                added_users.append(user.username)
                added_instances.append(user)
            except User.DoesNotExist:
                continue

        for email in emails:
            try:
                user = User.objects.get(email=email)
                room.participants.add(user)
                added_users.append(user.username)
                added_instances.append(user)
            except User.DoesNotExist:
                continue

        room.save()

        # ======================================================
        # Creating a system message in DB
        # ======================================================
        if added_users:
            msg_text = f"{request.user.username} added {', '.join(added_users)} to the chat."
            system_msg = SystemMessage.objects.create(room=room, content=msg_text)

            # ==================================================
            # Broadcast it via WebSocket to the room
            # ==================================================
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.id}",
                {
                    "type": "chat.system_message",
                    "event": "user_invited",
                    "message": msg_text,
                    "room_id": str(room.id),
                    "invited_users": added_users,
                },
            )
        # ==================================================
        # Sending personal invitation to each invited user
        # ==================================================
        for user in added_instances:
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {
                    "type": "chat.invitation",
                    "room_id": str(room.id),
                    "room_name": room.name,
                    "invited_by": request.user.username,
                    "message": f"You’ve been added to the chat {room.name or room.id}",
                },
            )
        return Response(
            {
                "room": str(room.id),
                "invited": added_users,
                "message": f"Added {len(added_users)} user(s) to this room."
            },
            status=200,
        )

# ============================================================
# Messages per room
# ============================================================
class MessageListCreateViewSet(viewsets.ModelViewSet):
    """
    Handles listing and posting messages in a given room.
      - GET /api/chat/rooms/<room_id>/messages/
      - POST /api/chat/rooms/<room_id>/messages/
    """
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
        serializer.save(room=room, sender=self.request.user)

# ============================================================
# backend/apps/chat/views.py
# TuChati - Chat API Views
# ============================================================
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer


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

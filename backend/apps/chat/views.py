# backend/apps/chat/views.py
# ============================================================
# backend/apps/chat/views.py
# TuChati - Chat API Views
# ============================================================
# This module exposes REST endpoints for:
#    Managing chat rooms (list, create, retrieve, update, delete)
#    Listing and creating messages per room
#
# Endpoints overview:
#   GET    /api/chat/rooms/       List user's rooms
#   POST   /api/chat/rooms/           Create a new room
#   GET    /api/chat/rooms/<uuid>/   Retrieve a specific room
#   PUT    /api/chat/rooms/<uuid>/      Update room info
#   DELETE /api/chat/rooms/<uuid>/   Delete a room
#   GET    /api/chat/rooms/<uuid>/messages/  List all messages in a room
#   POST   /api/chat/rooms/<uuid>/messages/   Send a new message
#
# Permissions:
#    All endpoints require JWT-authenticated users
#    Users can only interact with rooms where they are participants
# ============================================================

from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer


# ============================================================
# 🏠 Chat Room Endpoints
# ============================================================

class RoomListCreateView(generics.ListCreateAPIView):
    """
    GET   List all chat rooms the authenticated user participates in.
    POST Create a new chat room (group or direct).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatRoomSerializer

    def get_queryset(self):
        # Return only rooms the user is part of
        return ChatRoom.objects.filter(participants=self.request.user).distinct()

    def perform_create(self, serializer):
        # When creating a room, add the creator as a participant
        room = serializer.save()
        if not room.participants.filter(id=self.request.user.id).exists():
            room.participants.add(self.request.user)


class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    → Retrieve a specific chat room.
    PUT    → Update chat room info (e.g. name, is_group flag).
    DELETE → Remove a chat room.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatRoomSerializer
    lookup_field = "pk"  # UUID

    def get_queryset(self):
        # Restrict access to rooms the user belongs to
        return ChatRoom.objects.filter(participants=self.request.user).distinct()

    def perform_update(self, serializer):
        room = self.get_object()
        # Ensure only participants can update
        if not room.participants.filter(id=self.request.user.id).exists():
            raise PermissionDenied("You are not a participant of this room.")
        serializer.save()


# ============================================================
#  Message Endpoints
# ============================================================

class MessageListCreateView(generics.ListCreateAPIView):
    """
    GET  → List all messages in a given room.
    POST → Send a new message to the room.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        room_id = self.kwargs.get("room_id")
        # Verify the user has access to this room
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

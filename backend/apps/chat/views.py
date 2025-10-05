# backend/apps/chat/views.py
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer


class RoomListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatRoomSerializer

    def get_queryset(self):
        # Only rooms the user participates in
        return ChatRoom.objects.filter(participants=self.request.user).distinct()

    def perform_create(self, serializer):
        room = serializer.save()
        # Ensure the creator is added if not already
        if not room.participants.filter(id=self.request.user.id).exists():
            room.participants.add(self.request.user)


class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatRoomSerializer
    lookup_field = "pk"  # UUID

    def get_queryset(self):
        return ChatRoom.objects.filter(participants=self.request.user).distinct()

    def perform_update(self, serializer):
        room = self.get_object()
        if not room.participants.filter(id=self.request.user.id).exists():
            raise PermissionDenied("You are not a participant of this room.")
        serializer.save()


class MessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        room_id = self.kwargs.get("room_id")
        room = ChatRoom.objects.filter(id=room_id, participants=self.request.user).first()
        if not room:
            raise PermissionDenied("No access to this room.")
        return Message.objects.filter(room=room).select_related("sender")

    def perform_create(self, serializer):
        room_id = self.kwargs.get("room_id")
        room = ChatRoom.objects.filter(id=room_id, participants=self.request.user).first()
        if not room:
            raise PermissionDenied("No access to this room.")
        serializer.save(room=room)
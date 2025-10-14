# ============================================================
# backend/apps/chat/views.py
# TuChati Chat API Views (frontend-aligned)
# - Room list/create/retrieve
# - Invite users (WS system message + per-user invite)
# - Members endpoint for modal
# - Message list/create with WS broadcast (attachments/audio included)
# - Direct message helper
# ============================================================
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import ChatRoom, Message, SystemMessage
from .serializers import ChatRoomSerializer, MessageSerializer
from .utils import get_or_create_direct_room

User = get_user_model()


class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def get_queryset(self):
        return ChatRoom.objects.filter(participants=self.request.user).distinct()

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
        serializer = self.get_serializer(room)
        return Response(serializer.data, status=201)

    # -------- Members for modal ----------
    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        room = self.get_object()
        if not room.participants.filter(id=request.user.id).exists():
            raise PermissionDenied("You must be a participant.")

        qs = room.participants.all().values("id", "username", "email", "first_name", "last_name")
        members = []
        for u in qs:
            name = ((u.get("first_name") or "") + " " + (u.get("last_name") or "")).strip()
            members.append({
                "id": u["id"],
                "username": u["username"],
                "email": u["email"],
                "name": name or u["username"],
            })
        return Response(members)

    # -------- Invite users ----------
    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request, pk=None):
        """
        Body:
        {
          "usernames": ["alice", "bob"],
          "emails": ["user@domain.com"]
        }
        """
        room = self.get_object()

        if not room.participants.filter(id=request.user.id).exists():
            raise PermissionDenied("You must be a participant to invite others.")

        usernames = request.data.get("usernames", []) or []
        emails = request.data.get("emails", []) or []
        added_users = []
        added_instances = []

        # Fetch by username
        for username in usernames:
            try:
                u = User.objects.get(username=username)
                room.participants.add(u)
                added_users.append(u.username)
                added_instances.append(u)
            except User.DoesNotExist:
                continue

        # Fetch by email
        for email in emails:
            try:
                u = User.objects.get(email=email)
                room.participants.add(u)
                added_users.append(u.username)
                added_instances.append(u)
            except User.DoesNotExist:
                continue

        room.save()

        channel_layer = get_channel_layer()

        # System message in the room
        if added_users:
            msg_text = f"{request.user.username} added {', '.join(added_users)} to the chat."
            SystemMessage.objects.create(room=room, content=msg_text)

            async_to_sync(channel_layer.group_send)(
                f"room_{room.id}",
                {
                    "type": "chat_system_message",  # <- matches consumer handler
                    "event": "user_invited",
                    "message": msg_text,
                    "room_id": str(room.id),
                    "invited_users": added_users,
                },
            )

        # Personal invite to each invited user
        for u in added_instances:
            async_to_sync(channel_layer.group_send)(
                f"user_{u.id}",
                {
                    "type": "chat_invitation",  # <- matches consumer handler
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

    # -------- Direct message helper ----------
    @action(detail=False, methods=["post"], url_path="direct")
    def direct_message(self, request):
        username = request.data.get("to_username")
        content = (request.data.get("content") or "").strip()

        if not username or not content:
            return Response({"error": "to_username and content required"}, status=400)

        try:
            other_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        room = get_or_create_direct_room(request.user, other_user)
        msg = Message.objects.create(room=room, sender=request.user, content=content)

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"room_{room.id}",
            {
                "type": "chat_message",
                "payload": {
                    "type": "message",
                    "id": str(msg.id),
                    "sender": {
                        "id": request.user.id,
                        "username": request.user.username,
                        "name": request.user.get_full_name() or request.user.username,
                    },
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat(),
                },
            },
        )

        return Response({
            "room_id": str(room.id),
            "message": {
                "id": str(msg.id),
                "sender": request.user.username,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            }
        }, status=201)


# ============================================================
# Messages in a room
# ============================================================
class MessageListCreateViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        room_id = self.kwargs.get("room_id")
        room = ChatRoom.objects.filter(id=room_id, participants=self.request.user).first()
        if not room:
            raise PermissionDenied("You are not a participant of this room.")
        return Message.objects.filter(room=room).select_related("sender").order_by("created_at")

    def perform_create(self, serializer):
        room_id = self.kwargs.get("room_id")
        room = ChatRoom.objects.filter(id=room_id, participants=self.request.user).first()
        if not room:
            raise PermissionDenied("You are not a participant of this room.")

        msg = serializer.save(room=room, sender=self.request.user)

        # Broadcast to room so other clients get the message immediately
        data = MessageSerializer(msg).data  # should include attachment/audio if present
        payload = {
            **data,
            "type": "message",
            "sender": {
                "id": self.request.user.id,
                "username": self.request.user.username,
                "name": self.request.user.get_full_name() or self.request.user.username,
            },
        }

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"room_{room.id}",
            {"type": "chat_message", "payload": payload},
        )

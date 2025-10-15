# ============================================================
# backend/apps/chat/views.py
# ============================================================
# TuChati Chat API Views (frontend-aligned)
# ============================================================
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, NotFound
from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .consumers import _msg_to_dict, _user_display

from .models import ChatRoom, Message, SystemMessage, MessageUserMeta
from .serializers import ChatRoomSerializer, MessageSerializer
from .utils import get_or_create_direct_room

User = get_user_model()


def _message_preview(message: Message | None):
    if not message:
        return None
    sender = getattr(message, "sender", None) or message.sender
    return {
        "id": str(message.id),
        "sender_id": message.sender_id,
        "sender_name": _user_display(sender),
        "text": message.content or "",
        "attachment": message.attachment.url if getattr(message, "attachment", None) else None,
        "audio": message.voice_note.url if getattr(message, "voice_note", None) else None,
        "created_at": message.created_at.isoformat() if getattr(message, "created_at", None) else None,
    }


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

    _room_cache = None

    def _get_room(self):
        if self._room_cache is not None:
            return self._room_cache
        room_id = self.kwargs.get("room_id")
        room = (
            ChatRoom.objects.filter(id=room_id, participants=self.request.user)
            .prefetch_related("admins")
            .first()
        )
        if not room:
            raise PermissionDenied("You are not a participant of this room.")
        self._room_cache = room
        return room

    def _is_room_admin(self, room: ChatRoom, user) -> bool:
        return room.admins.filter(id=user.id).exists()

    def get_queryset(self):
        room = self._get_room()
        queryset = (
            Message.objects.filter(room=room)
            .select_related(
                "sender",
                "reply_to",
                "reply_to__sender",
                "forwarded_from",
                "forwarded_from__sender",
                "pinned_by",
            )
            .prefetch_related(
                "reactions",
                Prefetch(
                    "user_meta",
                    queryset=MessageUserMeta.objects.filter(user=self.request.user),
                    to_attr="meta_for_user",
                ),
                "delivered_to",
                "read_by",
            )
            .order_by("created_at")
        )
        deleted_subquery = MessageUserMeta.objects.filter(
            user=self.request.user,
            deleted_for_me=True,
            message__room=room,
        ).values_list("message_id", flat=True)
        return queryset.exclude(id__in=deleted_subquery)

    def perform_create(self, serializer):
        room = self._get_room()
        message: Message = serializer.save(room=room, sender=self.request.user)

        # broadcast to WS listeners so other clients see uploads/voice notes instantly
        channel_layer = get_channel_layer()
        public_payload = _msg_to_dict(message)
        async_to_sync(channel_layer.group_send)(
            f"room_{room.id}",
            {"type": "chat_message", "payload": public_payload},
        )

        if getattr(message, "meta_for_user", None):
            own_payload = _msg_to_dict(message, current_user_id=self.request.user.id)
            async_to_sync(channel_layer.group_send)(
                f"user_{self.request.user.id}",
                {"type": "message_meta", "payload": own_payload},
            )

    def _get_message(self, pk: str) -> Message:
        room = self._get_room()
        try:
            message = self.get_queryset().get(id=pk)
        except Message.DoesNotExist as exc:
            raise NotFound("Message not found") from exc
        if message.room_id != room.id:
            raise PermissionDenied("Message does not belong to this room")
        return message

    def _get_meta(self, message: Message, user) -> MessageUserMeta:
        meta, _ = MessageUserMeta.objects.get_or_create(message=message, user=user)
        return meta

    @action(detail=True, methods=["post"], url_path="delete")
    def delete_message(self, request, room_id=None, pk=None):
        scope = request.data.get("scope", "me")
        room = self._get_room()
        message = self._get_message(pk)
        channel_layer = get_channel_layer()

        if scope == "all":
            if message.sender_id != request.user.id and not self._is_room_admin(room, request.user):
                raise PermissionDenied("You cannot delete this message for everyone.")
            message_id = str(message.id)
            message.delete()
            async_to_sync(channel_layer.group_send)(
                f"room_{room.id}",
                {"type": "message_remove", "message_id": message_id},
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        meta = self._get_meta(message, request.user)
        if not meta.deleted_for_me:
            meta.deleted_for_me = True
            meta.save(update_fields=["deleted_for_me", "updated_at"])
        async_to_sync(channel_layer.group_send)(
            f"user_{request.user.id}",
            {"type": "message_remove", "message_id": str(message.id)},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, room_id=None):
        ids = request.data.get("ids") or []
        scope = request.data.get("scope", "me")
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)

        room = self._get_room()
        messages = list(self.get_queryset().filter(id__in=ids))
        channel_layer = get_channel_layer()

        if scope == "all":
            deletable = []
            for msg in messages:
                if msg.sender_id == request.user.id or self._is_room_admin(room, request.user):
                    deletable.append(msg)
            deleted_ids = [str(msg.id) for msg in deletable]
            for msg in deletable:
                msg.delete()
            if deleted_ids:
                async_to_sync(channel_layer.group_send)(
                    f"room_{room.id}",
                    {"type": "message_remove_bulk", "message_ids": deleted_ids},
                )
            return Response({"deleted": deleted_ids})

        # delete for self only
        removed = []
        for msg in messages:
            meta = self._get_meta(msg, request.user)
            if not meta.deleted_for_me:
                meta.deleted_for_me = True
                meta.save(update_fields=["deleted_for_me", "updated_at"])
            removed.append(str(msg.id))

        if removed:
            async_to_sync(channel_layer.group_send)(
                f"user_{request.user.id}",
                {"type": "message_remove_bulk", "message_ids": removed},
            )

        return Response({"deleted": removed})

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, room_id=None, pk=None):
        should_pin = bool(request.data.get("pinned", True))
        room = self._get_room()
        message = self._get_message(pk)
        if not self._is_room_admin(room, request.user) and message.sender_id != request.user.id:
            raise PermissionDenied("You cannot pin this message.")

        if should_pin:
            message.pinned = True
            message.pinned_by = request.user
        else:
            message.pinned = False
            if message.pinned_by_id == request.user.id or self._is_room_admin(room, request.user):
                message.pinned_by = None
        message.save(update_fields=["pinned", "pinned_by"])

        payload = _msg_to_dict(message)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"room_{room.id}",
            {"type": "message_update", "payload": payload},
        )
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="star")
    def star(self, request, room_id=None, pk=None):
        starred = bool(request.data.get("starred", True))
        message = self._get_message(pk)
        meta = self._get_meta(message, request.user)
        meta.starred = starred
        meta.save(update_fields=["starred", "updated_at"])
        message.meta_for_user = [meta]

        payload = _msg_to_dict(message, current_user_id=request.user.id)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{request.user.id}",
            {"type": "message_meta", "payload": payload},
        )
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="note")
    def note(self, request, room_id=None, pk=None):
        note_text = request.data.get("note", "")
        message = self._get_message(pk)
        meta = self._get_meta(message, request.user)
        meta.note = note_text
        meta.save(update_fields=["note", "updated_at"])
        message.meta_for_user = [meta]

        payload = _msg_to_dict(message, current_user_id=request.user.id)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{request.user.id}",
            {"type": "message_meta", "payload": payload},
        )
        return Response(payload)

    @action(detail=True, methods=["get"], url_path="info")
    def info(self, request, room_id=None, pk=None):
        message = self._get_message(pk)
        data = {
            "id": str(message.id),
            "sender": {
                "id": message.sender_id,
                "name": _user_display(message.sender),
            },
            "created_at": message.created_at.isoformat(),
            "content": message.content,
            "attachment": message.attachment.url if message.attachment else None,
            "audio": message.voice_note.url if message.voice_note else None,
            "pinned": message.pinned,
            "pinned_by": (
                {
                    "id": message.pinned_by_id,
                    "name": _user_display(message.pinned_by),
                }
                if message.pinned_by
                else None
            ),
            "reply_to": _message_preview(message.reply_to) if message.reply_to_id else None,
            "forwarded_from": _message_preview(message.forwarded_from) if message.forwarded_from_id else None,
            "delivered_to": [
                {
                    "id": user.id,
                    "name": _user_display(user),
                }
                for user in message.delivered_to.all()
            ],
            "read_by": [
                {
                    "id": user.id,
                    "name": _user_display(user),
                }
                for user in message.read_by.all()
            ],
        }

        meta = MessageUserMeta.objects.filter(message=message, user=request.user).first()
        data["starred"] = bool(meta.starred) if meta else False
        data["note"] = meta.note if meta else ""

        return Response(data)

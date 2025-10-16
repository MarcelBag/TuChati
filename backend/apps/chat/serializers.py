# backend/apps/chat/serializers.py
# ============================================================
# TuChati Chat serializers (frontend-aligned, no 500s)
# ============================================================
from django.db.models import Max
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, MessageUserMeta, DirectChatRequest
from .consumers import _msg_to_dict

User = get_user_model()


class ChatRoomSerializer(serializers.ModelSerializer):
    # Frontend extras
    member_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    admin_ids = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()     # computed, not a model field
    last_message = serializers.SerializerMethodField()   # compact preview object

    class Meta:
        model = ChatRoom
        fields = [
            "id",
            "name",
            "is_group",
            "member_count",
            "members",
            "is_admin",
            "admin_ids",
            "last_message",
            "updated_at",          # computed
            "created_at",          # only if your model has it; otherwise remove this line
        ]

    # ---- helpers used by the UI ----
    def get_member_count(self, obj: ChatRoom) -> int:
        return obj.participants.count()

    def get_members(self, obj: ChatRoom):
        rows = obj.participants.all().values(
            "id", "username", "email", "first_name", "last_name"
        )
        out = []
        for r in rows:
            full = ((r.get("first_name") or "") + " " + (r.get("last_name") or "")).strip()
            out.append(
                {
                    "id": r["id"],
                    "username": r["username"],
                    "name": full or r["username"],
                    "email": r.get("email"),
                }
            )
        return out

    def get_is_admin(self, obj: ChatRoom) -> bool:
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.admins.filter(id=request.user.id).exists()

    def get_admin_ids(self, obj: ChatRoom):
        return list(obj.admins.values_list("id", flat=True))

    def get_updated_at(self, obj: ChatRoom):
        # “activity” time: last message timestamp or room.created_at
        last = (
            Message.objects.filter(room=obj)
            .aggregate(m=Max("created_at"))
            .get("m")
        )
        if last:
            return last.isoformat()
        # fall back to model timestamp if present
        created_at = getattr(obj, "created_at", None)
        return created_at.isoformat() if created_at else None

    def get_last_message(self, obj: ChatRoom):
        m = (
            Message.objects.filter(room=obj)
            .select_related("sender")
            .order_by("-created_at")
            .first()
        )
        if not m:
            return None
        return {
            "id": str(m.id),
            "content": m.content,
            "text": m.content,  # so your UI's preview() finds a sensible field
            "created_at": m.created_at.isoformat(),
            "sender": {
                "id": m.sender_id,
                "username": m.sender.username,
                "name": (getattr(m.sender, "get_full_name", lambda: "")() or m.sender.username),
            },
        }


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField(read_only=True)
    audio = serializers.FileField(source="voice_note", allow_null=True, required=False)
    reply_to_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    forwarded_from_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    starred = serializers.BooleanField(write_only=True, required=False)
    note = serializers.CharField(write_only=True, required=False, allow_blank=True)
    _client_id = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "content",
            "attachment",
            "audio",
            "created_at",
            "sender",
            "reply_to_id",
            "forwarded_from_id",
            "starred",
            "note",
            "_client_id",
        ]
        extra_kwargs = {
            "content": {"allow_blank": True, "required": False},
            "attachment": {"required": False},
        }

    def validate(self, attrs):
        max_bytes = 3 * 1024 * 1024
        file_fields = {
            "attachment": attrs.get("attachment"),
            "audio": attrs.get("voice_note"),
        }
        errors = {}
        for field, file in file_fields.items():
            if file and hasattr(file, "size") and file.size > max_bytes:
                errors[field] = "File too large (max 3 MB)."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required")

        reply_to_id = validated_data.pop("reply_to_id", None)
        forwarded_from_id = validated_data.pop("forwarded_from_id", None)
        starred = validated_data.pop("starred", False)
        note = validated_data.pop("note", "")
        validated_data.pop("_client_id", None)

        message = Message.objects.create(
            reply_to_id=reply_to_id,
            forwarded_from_id=forwarded_from_id,
            **validated_data,
        )

        meta_obj = None
        if note or starred:
            meta_obj, _ = MessageUserMeta.objects.update_or_create(
                message=message,
                user=user,
                defaults={
                    "starred": starred,
                    "note": note,
                    "deleted_for_me": False,
                },
            )
        else:
            meta_obj = None

        message.sender = user
        message.meta_for_user = [meta_obj] if meta_obj else []

        return message

    def to_representation(self, instance: Message):
        request = self.context.get("request")
        current_user_id = None
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            current_user_id = request.user.id
            if not hasattr(instance, "meta_for_user"):
                instance.meta_for_user = list(
                    MessageUserMeta.objects.filter(message=instance, user_id=current_user_id)
                )

        data = _msg_to_dict(instance, current_user_id=current_user_id)
        data["sender"] = self.get_sender(instance)
        return data

    def get_sender(self, obj: Message):
        u = obj.sender
        return {
            "id": u.id,
            "username": u.username,
            "name": (getattr(u, "get_full_name", lambda: "")() or u.username),
        }


class DirectChatRequestSerializer(serializers.ModelSerializer):
    from_user = serializers.SerializerMethodField()
    to_user = serializers.SerializerMethodField()
    room = serializers.SerializerMethodField()

    class Meta:
        model = DirectChatRequest
        fields = [
            "id",
            "status",
            "initial_message",
            "created_at",
            "responded_at",
            "from_user",
            "to_user",
            "room",
        ]

    def get_from_user(self, obj: DirectChatRequest):
        return {
            "id": obj.from_user_id,
            "username": obj.from_user.username,
            "name": (getattr(obj.from_user, "get_full_name", lambda: "")() or obj.from_user.username),
        }

    def get_to_user(self, obj: DirectChatRequest):
        return {
            "id": obj.to_user_id,
            "username": obj.to_user.username,
            "name": (getattr(obj.to_user, "get_full_name", lambda: "")() or obj.to_user.username),
        }

    def get_room(self, obj: DirectChatRequest):
        if obj.room:
            return {
                "id": str(obj.room_id),
                "is_group": obj.room.is_group,
                "is_pending": obj.room.is_pending,
            }
        return None

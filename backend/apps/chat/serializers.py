# backend/apps/chat/serializers.py
# ============================================================
# TuChati Chat serializers (frontend-aligned, no 500s)
# ============================================================
from django.db.models import Max
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message

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
    sender = serializers.SerializerMethodField()
    audio = serializers.FileField(source="voice_note", allow_null=True, required=False)

    class Meta:
        model = Message
        fields = [
            "id",
            "content",
            "attachment",
            "audio",
            "created_at",
            "sender",
        ]

    def get_sender(self, obj: Message):
        u = obj.sender
        return {
            "id": u.id,
            "username": u.username,
            "name": (getattr(u, "get_full_name", lambda: "")() or u.username),
        }

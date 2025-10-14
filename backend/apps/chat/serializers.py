# backend/apps/chat/serializers.py
# ============================================================
# TuChati Chat serializers (frontend-aligned)
# ============================================================
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message

User = get_user_model()


class MemberLiteSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    name = serializers.CharField()
    email = serializers.EmailField(allow_null=True, required=False)


class ChatRoomSerializer(serializers.ModelSerializer):
    # Frontend expects these:
    member_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    admin_ids = serializers.SerializerMethodField()

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
            "created_at",
            "updated_at",
            # include whatever else you already expose (e.g. last_message)
        ]

    # ---- helpers used by the UI ----
    def get_member_count(self, obj: ChatRoom) -> int:
        return obj.participants.count()

    def get_members(self, obj: ChatRoom):
        # compact list for the right-side “Members” pane
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
        # the viewer is admin?
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.admins.filter(id=request.user.id).exists()

    def get_admin_ids(self, obj: ChatRoom):
        return list(obj.admins.values_list("id", flat=True))


class MessageSerializer(serializers.ModelSerializer):
    # Keep your existing fields, but ensure these common ones exist.
    sender = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "content",
            "attachment",
            "audio",
            "created_at",
            "sender",  # {id, username, name}
        ]

    def get_sender(self, obj: Message):
        u = obj.sender
        return {
            "id": u.id,
            "username": u.username,
            "name": (getattr(u, "get_full_name", lambda: "")() or u.username),
        }

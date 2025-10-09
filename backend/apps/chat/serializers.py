# backend/apps/chat/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message

User = get_user_model()


class UserMiniSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for message context."""
    class Meta:
        model = User
        fields = ["id", "username", "email"]

class MessageSerializer(serializers.ModelSerializer):
    sender = UserMiniSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "room", "sender", "content", "is_read", "created_at"]
        read_only_fields = ["id", "room", "sender", "is_read", "created_at"]


class ChatRoomSerializer(serializers.ModelSerializer):
    participants = UserMiniSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ["id", "name", "is_group", "participants", "last_message", "created_at"]

    def get_last_message(self, obj):
        """Return the last message in the room."""
        message = obj.messages.order_by("-created_at").first()
        if message:
            return MessageSerializer(message).data
        return None

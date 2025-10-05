# backend/apps/chat/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message

User = get_user_model()


class UserSlimSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username"]


class ChatRoomSerializer(serializers.ModelSerializer):
    participants = UserSlimSerializer(many=True, read_only=True)
    participants_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=User.objects.all(), source="participants"
    )

    class Meta:
        model = ChatRoom
        fields = ["id", "name", "is_group", "participants", "participants_ids", "created_at"]
        read_only_fields = ["id", "participants", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSlimSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "room", "sender", "content", "is_read", "created_at"]
        read_only_fields = ["id", "sender", "is_read", "created_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["sender"] = request.user
        return super().create(validated_data)
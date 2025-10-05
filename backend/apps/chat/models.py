# ================================================================
# backend/apps/chat/models.py
# Extended Chat models with delivery + read receipts
# ================================================================
import uuid
from django.conf import settings
from django.db import models


# ================================================================
# ChatRoom model
# ================================================================
class ChatRoom(models.Model):
    """A room for 1:1 or group chat."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True, default="")
    is_group = models.BooleanField(default=False)

    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="chat_rooms",
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        base = self.name or "Room"
        return f"{base} ({'Group' if self.is_group else 'Direct'})"


# ================================================================
# Message model
# ================================================================
class Message(models.Model):
    """Represents a message sent inside a ChatRoom."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages")

    # Message content & attachments
    content = models.TextField(blank=True)
    attachment = models.FileField(upload_to="chat_attachments/", blank=True, null=True)
    voice_note = models.FileField(upload_to="chat_voice_notes/", blank=True, null=True)

    # Message state
    is_read = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    deleted_for = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="deleted_messages", blank=True)
    delivered_to = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="delivered_messages", blank=True)
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="read_messages", blank=True)

    # Delivery / Read timestamps
    delivered_at = models.DateTimeField(blank=True, null=True)
    read_at = models.DateTimeField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self):
        preview = self.content[:20] + "..." if self.content else "[Attachment]"
        return f"{self.sender} → {self.room}: {preview}"


# ================================================================
# MessageReaction model
# ================================================================
class MessageReaction(models.Model):
    """Emoji reactions to messages (👍❤️😂 etc.)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user", "emoji")
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.user} reacted {self.emoji} to {self.message.id}"

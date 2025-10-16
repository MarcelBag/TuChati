# ================================================================
# backend/apps/chat/models.py
# Extended Chat models with delivery, read receipts, and metadata
# ================================================================
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


# ================================================================
# ChatRoom model
# ================================================================
class ChatRoom(models.Model):
    """A room for 1:1 or group chat."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True, default="")
    is_group = models.BooleanField(default=False)
    is_pending = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    icon = models.ImageField(upload_to="chat_icons/", blank=True, null=True)

    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="chat_rooms",
        blank=True,
    )

    admins = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="admin_rooms",
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
    thumbnail = models.ImageField(upload_to="chat_thumbnails/", blank=True, null=True)
    file_type = models.CharField(max_length=50, blank=True)
    duration = models.FloatField(blank=True, null=True)

    # Relationships & features
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies")
    forwarded_from = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="forwards")
    pinned = models.BooleanField(default=False)
    pinned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pinned_messages",
    )
    expires_at = models.DateTimeField(blank=True, null=True)
    is_system = models.BooleanField(default=False)

    # Message state
    is_read = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    deleted_for = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="deleted_messages", blank=True)
    delivered_to = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="delivered_messages", blank=True)
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="read_messages", blank=True)
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
# SystemMessage model
# ================================================================
class SystemMessage(models.Model):
    """Automated system notifications like joins, leaves, or updates."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="system_messages")
    content = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"System: {self.content}"


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


class MessageUserMeta(models.Model):
    """Per-user metadata for a message (star, notes, deleted-for-me)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="user_meta",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="message_meta",
    )
    starred = models.BooleanField(default=False)
    note = models.TextField(blank=True)
    deleted_for_me = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("message", "user")
        indexes = [
            models.Index(fields=("user", "starred")),
            models.Index(fields=("message", "deleted_for_me")),
        ]

    def __str__(self) -> str:
        return f"Meta<{self.user_id}:{self.message_id}>"


class DirectChatRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"

    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.OneToOneField(ChatRoom, on_delete=models.CASCADE, related_name="direct_request")
    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="direct_requests_sent")
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="direct_requests_received")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    initial_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("-created_at",)
        unique_together = ("from_user", "to_user", "status")

    def mark(self, status: str):
        self.status = status
        self.responded_at = timezone.now()
        self.save(update_fields=["status", "responded_at"])

    def __str__(self):
        return f"DirectRequest({self.from_user}->{self.to_user} : {self.status})"

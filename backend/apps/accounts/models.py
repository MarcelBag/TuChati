#backend/apps/accounts/models.py
# ================================================================
# backend/apps/accounts/models.py
# Extended User model with presence, device tracking, and security
# ================================================================
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


def generate_uuid():
    return uuid.uuid4()

class User(AbstractUser):
    """Custom user with presence, profile, and security extensions."""

    uuid = models.UUIDField(default=generate_uuid, editable=False, unique=True)

    # Profile details
    phone = models.CharField(max_length=20, blank=True, null=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    status_message = models.CharField(max_length=255, blank=True)
    status_updated_at = models.DateTimeField(auto_now_add=True)
    user_timezone = models.CharField(max_length=64, default="UTC")


    # Presence & availability
    is_online = models.BooleanField(default=False)
    current_status = models.CharField(
        max_length=20,
        choices=[
            ("online", "Online"),
            ("away", "Away"),
            ("offline", "Offline"),
            ("dnd", "Do Not Disturb"),
        ],
        default="offline",
    )
    device_type = models.CharField(
        max_length=20,
        choices=[
            ("web", "Web"),
            ("mobile", "Mobile"),
            ("desktop", "Desktop"),
        ],
        default="web",
    )
    last_seen = models.DateTimeField(default=timezone.now)

    # Security / privacy
    blocked_users = models.ManyToManyField(
        "self",
        symmetrical=False,
        related_name="blocked_by",
        blank=True,
    )
    end_to_end_key = models.TextField(blank=True, null=True)

    def mark_online(self, device="web"):
        self.is_online = True
        self.device_type = device
        self.current_status = "online"
        self.last_seen = timezone.now()
        self.save(update_fields=["is_online", "device_type", "current_status", "last_seen"])

    def mark_offline(self):
        self.is_online = False
        self.current_status = "offline"
        self.last_seen = timezone.now()
        self.save(update_fields=["is_online", "current_status", "last_seen"])

    def __str__(self):
        return f"{self.username} ({'Online' if self.is_online else 'Offline'})"


# ================================================================
#  DeviceSession model
# ================================================================
class DeviceSession(models.Model):
    """Tracks user login sessions per device (for multi-device support)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="device_sessions")
    device_type = models.CharField(max_length=20)
    device_name = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username} [{self.device_type}]"

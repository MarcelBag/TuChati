#backend/apps/accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Custom user model using email as the unique login field."""
    email = models.EmailField(unique=True)

    # Profile & personalization
    avatar = models.ImageField(
        upload_to="avatars/",
        blank=True,
        null=True,
        help_text="User profile photo."
    )
    status_message = models.CharField(
        max_length=255,
        blank=True,
        default="Hey there! I'm using TuChati.",
        help_text="Short status shown in chat or profile view."
    )
    status_updated_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the user last updated their status."
    )
    bio = models.TextField(blank=True, null=True, help_text="about/bio section.")
    phone = models.CharField(max_length=20, blank=True, null=True)
    timezone = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="User's preferred timezone, 'Africa/Kinshasa'."
    )

    # Online presence
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(blank=True, null=True)

    # Auth customization
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.get_full_name() or self.email

    class Meta:
        ordering = ["username"]

    def update_status(self, new_status: str):
        """Utility to update user status and timestamp."""
        self.status_message = new_status
        self.status_updated_at = timezone.now()
        self.save(update_fields=["status_message", "status_updated_at"])

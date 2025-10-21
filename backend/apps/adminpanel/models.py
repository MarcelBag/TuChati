import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Role(models.Model):
    """
    High-level admin center role.
    Each role carries a list of permission codes (string identifiers) that
    frontend clients can interpret to enable/disable UI features.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list, blank=True)
    users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="admin_roles",
        blank=True,
    )
    is_system = models.BooleanField(
        default=False,
        help_text="System roles are managed via migrations and cannot be deleted.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class AuditEvent(models.Model):
    """
    Simple audit trail for privileged operations.
    """

    SEVERITY_INFO = "info"
    SEVERITY_WARNING = "warning"
    SEVERITY_ERROR = "error"

    SEVERITY_CHOICES = (
        (SEVERITY_INFO, "Info"),
        (SEVERITY_WARNING, "Warning"),
        (SEVERITY_ERROR, "Error"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=128)
    message = models.TextField(blank=True)
    severity = models.CharField(
        max_length=16, choices=SEVERITY_CHOICES, default=SEVERITY_INFO
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="audit_events",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    target = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("event_type",)),
            models.Index(fields=("severity",)),
            models.Index(fields=("created_at",)),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} ({self.severity})"

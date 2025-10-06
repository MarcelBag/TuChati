# backend/apps/accounts/signals.py
from django.dispatch import receiver
from rest_framework_simplejwt.signals import token_obtained
from apps.accounts.models import DeviceSession
from django.utils import timezone

@receiver(token_obtained)
def track_device_session(sender, request, token, user, **kwargs):
    """Record or refresh a device session when JWT is obtained."""
    device_type = request.headers.get("X-Device-Type", "web")
    ip_address = request.META.get("REMOTE_ADDR")
    token_str = str(token.get("access"))

    session, _ = DeviceSession.objects.get_or_create(
        user=user,
        token=token_str,
        defaults={
            "device_type": device_type,
            "ip_address": ip_address,
            "connection_status": "online",
            "last_active": timezone.now(),
        },
    )
    session.touch()

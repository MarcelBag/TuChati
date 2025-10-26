from __future__ import annotations

from typing import Optional, Tuple

from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

from .models import DeviceSession


DEFAULT_FROM = getattr(settings, 'DEFAULT_FROM_EMAIL', 'TuChati <no-reply@tuchati.tuunganes.com>')


def record_device_session(user, request=None, token: Optional[str] = None) -> Tuple[Optional[DeviceSession], bool]:
    """Persist/refresh a session and email when a new device signs in."""
    if not user or not token:
        return None, False

    token_str = str(token)
    device_type = 'web'
    ip_address = None
    device_name = ''
    app_version = ''

    if request is not None:
        device_type = request.headers.get('X-Device-Type', 'web') or 'web'
        ip_address = request.META.get('REMOTE_ADDR')
        device_name = request.headers.get('X-Device-Name', '')
        app_version = request.headers.get('X-App-Version', '')

    session, created = DeviceSession.objects.get_or_create(
        user=user,
        token=token_str,
        defaults={
            'device_type': device_type,
            'device_name': device_name or device_type,
            'ip_address': ip_address,
            'app_version': app_version,
            'connection_status': 'online',
            'last_active': timezone.now(),
            'last_seen': timezone.now(),
        },
    )

    if not created:
        fields_to_update = []
        if device_type and device_type != session.device_type:
            session.device_type = device_type
            fields_to_update.append('device_type')
        if device_name and device_name != session.device_name:
            session.device_name = device_name
            fields_to_update.append('device_name')
        if ip_address and ip_address != session.ip_address:
            session.ip_address = ip_address
            fields_to_update.append('ip_address')
        if app_version and app_version != session.app_version:
            session.app_version = app_version
            fields_to_update.append('app_version')
        if fields_to_update:
            session.save(update_fields=fields_to_update)

    session.touch()

    if created:
        email = getattr(user, 'email', None)
        if email:
            try:
                username = getattr(user, 'username', '') or getattr(user, 'email', '') or 'there'
                message = (
                    "TuChati\n"
                    "tuchati.tuunganes.com\n\n"
                    f"Hi {username},\n\n"
                    "A new device just signed in to your TuChati account.\n"
                    f"Device: {device_name or device_type}\n"
                    f"IP address: {ip_address or 'Unknown'}\n\n"
                    "If this wasn’t you, please reset your password immediately.\n\n"
                    "If you didn’t request this, you can safely ignore this email.\n"
                    "Your TuChati team"
                )
                send_mail('New TuChati login', message, DEFAULT_FROM, [email], fail_silently=True)
            except Exception:
                pass

    return session, created

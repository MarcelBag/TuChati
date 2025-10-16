from __future__ import annotations

from typing import Optional

from django.utils import timezone

from .models import DeviceSession


def record_device_session(user, request=None, token: Optional[str] = None):
    """Persist or refresh a device session for the given user."""
    if not user or not token:
        return

    token_str = str(token)
    device_type = 'web'
    ip_address = None
    device_name = ''
    app_version = ''

    if request is not None:
        device_type = request.headers.get('X-Device-Type', 'web')
        ip_address = request.META.get('REMOTE_ADDR')
        device_name = request.headers.get('X-Device-Name', '')
        app_version = request.headers.get('X-App-Version', '')

    session, created = DeviceSession.objects.get_or_create(
        user=user,
        token=token_str,
        defaults={
            'device_type': device_type or 'web',
            'device_name': device_name or device_type or 'web',
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

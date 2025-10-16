"""Email template rendering for two-factor flows."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

from django.conf import settings
from django.template.loader import render_to_string
from email.utils import parseaddr

APP_NAME = getattr(settings, "APP_BRAND_NAME", "TuChati")
APP_URL = getattr(settings, "APP_BRAND_URL", "https://tuchati.tuunganes.com")
DEFAULT_SUPPORT = getattr(
    settings,
    "APP_SUPPORT_EMAIL",
    getattr(settings, "DEFAULT_FROM_EMAIL", "support@tuchati.tuunganes.com"),
)
SUPPORT_ADDRESS = parseaddr(DEFAULT_SUPPORT)[1] or DEFAULT_SUPPORT


@dataclass(frozen=True)
class EmailContext:
    username: str | None
    code: str | None
    purpose: str | None
    expires_in_seconds: int | None

    def as_dict(self) -> dict[str, str | int | None]:
        expires_display = self._format_expiry()
        code_spaced = " ".join(self.code) if self.code else ""
        greeting = f"Hi {self.username}," if self.username else "Hello," if self.code else (
            f"Welcome, {self.username}!" if self.username else f"Welcome to {APP_NAME}!"
        )
        return {
            "app_name": APP_NAME,
            "app_url": APP_URL,
            "brand_initials": APP_NAME[:2].upper(),
            "support_email": SUPPORT_ADDRESS,
            "username": self.username,
            "code": self.code,
            "code_spaced": code_spaced,
            "purpose": self.purpose,
            "expires_seconds": self.expires_in_seconds,
            "expires_display": expires_display,
            "greeting": greeting,
        }

    def _format_expiry(self) -> str:
        if not self.expires_in_seconds:
            return ""
        minutes, seconds = divmod(self.expires_in_seconds, 60)
        parts: list[str] = []
        if minutes:
            parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
        if seconds:
            parts.append(f"{seconds} second{'s' if seconds != 1 else ''}")
        return " ".join(parts) if parts else "a moment"


def render_verification_email(username: str, code: str, purpose: str, expires_in_seconds: int) -> Tuple[str, str]:
    context = EmailContext(
        username=username,
        code=code,
        purpose=purpose,
        expires_in_seconds=expires_in_seconds,
    ).as_dict()
    plain = render_to_string("twofa/verification_email.txt", context)
    html = render_to_string("twofa/verification_email.html", context)
    return plain.strip(), html


def render_welcome_email(username: str) -> Tuple[str, str]:
    context = EmailContext(
        username=username,
        code=None,
        purpose=None,
        expires_in_seconds=None,
    ).as_dict()
    plain = render_to_string("twofa/welcome_email.txt", context)
    html = render_to_string("twofa/welcome_email.html", context)
    return plain.strip(), html


__all__ = [
    "render_verification_email",
    "render_welcome_email",
    "APP_NAME",
]

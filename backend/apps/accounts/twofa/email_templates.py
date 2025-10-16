"""Email template rendering for two-factor flows."""
from __future__ import annotations

from email.utils import parseaddr
from typing import Tuple

from django.conf import settings

APP_NAME = getattr(settings, "APP_BRAND_NAME", "TuChati")
APP_URL = getattr(settings, "APP_BRAND_URL", "https://tuchati.tuunganes.com")
_APP_DEFAULT_SUPPORT = getattr(settings, "APP_SUPPORT_EMAIL", getattr(settings, "DEFAULT_FROM_EMAIL", "support@tuchati.tuunganes.com"))
SUPPORT_EMAIL = parseaddr(_APP_DEFAULT_SUPPORT)[1] or _APP_DEFAULT_SUPPORT


def _wrap_html(inner: str) -> str:
    return (
        "<!DOCTYPE html>\n"
        "<html lang='en'>\n"
        "  <head>\n"
        "    <meta charset='utf-8' />\n"
        "    <meta name='viewport' content='width=device-width, initial-scale=1' />\n"
        f"    <title>{APP_NAME}</title>\n"
        "  </head>\n"
        "  <body style=\"margin:0;background:#0b1120;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;\">\n"
        "    <table role='presentation' cellspacing='0' cellpadding='0' width='100%' style='padding:32px 0;'>\n"
        "      <tr>\n"
        "        <td align='center'>\n"
        "          <table role='presentation' width='620' cellspacing='0' cellpadding='0' style='width:620px;max-width:100%;background:linear-gradient(160deg,#0f172a,#0b1120 55%,#020617);border-radius:32px;overflow:hidden;border:1px solid rgba(148,163,184,0.15);box-shadow:0 24px 65px rgba(15,23,42,0.55);'>\n"
        f"            {inner}\n"
        "          </table>\n"
        f"          <p style='margin:28px 0 0;font-size:12px;color:rgba(148,163,184,0.68);'>© {APP_NAME} · <a href='{APP_URL}' style='color:#38bdf8;text-decoration:none;'>{APP_URL}</a></p>\n"
        "        </td>\n"
        "      </tr>\n"
        "    </table>\n"
        "  </body>\n"
        "</html>\n"
    )


def _brand_block(subheading: str) -> str:
    initials = APP_NAME[:2].upper()
    return (
        "<tr>"
        "  <td style='padding:38px 48px 30px;background:linear-gradient(135deg,rgba(34,211,238,0.08),rgba(99,102,241,0.35));'>"
        "    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='color:#f8fafc;'>"
        "      <tr>"
        "        <td style='width:64px;'>"
        f"          <div style='width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#22d3ee,#6366f1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;color:#0f172a;'>{initials}</div>"
        "        </td>"
        "        <td>"
        f"          <p style='margin:0;font-size:24px;font-weight:700;letter-spacing:-0.02em;'>{APP_NAME}</p>"
        f"          <p style='margin:6px 0 0;font-size:15px;letter-spacing:0.03em;text-transform:uppercase;color:rgba(226,232,240,0.7);'>{subheading}</p>"
        "        </td>"
        "      </tr>"
        "    </table>"
        "  </td>"
        "</tr>"
    )


def render_verification_email(username: str, code: str, purpose: str, expires_in_seconds: int) -> Tuple[str, str]:
    greeting = f"Hi {username}," if username else "Hello,"  # simple fallback
    code_digits = " ".join(code)

    plain = (
        f"{APP_NAME}\n{APP_URL}\n\n"
        f"{greeting}\n\n"
        f"Here is your {APP_NAME} verification code to {purpose}:\n\n"
        f"    {code}\n\n"
        f"This code expires in {expires_in_seconds} seconds.\n"
        "If this wasn’t you, please reset your password immediately.\n\n"
        "Need assistance? Email us at "
        f"{SUPPORT_EMAIL}.\n\n"
        f"— The {APP_NAME} team\n"
    )

    body = (
        "<tr>"
        "  <td style='padding:36px 48px 40px;'>"
        "    <div style='color:#cbd5f5;font-size:16px;line-height:1.7;'>"
        f"      <p style='margin:0 0 14px;color:#f1f5f9;font-size:18px;font-weight:600;'>{greeting}</p>"
        f"      <p style='margin:0 0 20px;'>Use this code to {purpose}. It expires in <strong>{expires_in_seconds // 60 if expires_in_seconds >= 60 else expires_in_seconds} minute</strong> or sooner.</p>"
        "    </div>"
        "    <div style='margin:28px 0;padding:22px;border-radius:26px;background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(186,230,253,0.08));border:1px solid rgba(148,163,184,0.25);'>"
        f"      <p style='margin:0;font-size:13px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(148,163,184,0.75);'>Your code</p>"
        f"      <div style='font-size:36px;font-weight:700;letter-spacing:0.75em;color:#f8fafc;margin-top:16px;text-align:center;'>{code_digits}</div>"
        "    </div>"
        "    <p style='margin:0 0 12px;font-size:14px;color:#94a3b8;'>If you didn’t request this, you can safely ignore this email.</p>"
        f"    <p style='margin:0 0 32px;font-size:14px;color:#64748b;'>Need a hand? <a href='mailto:{SUPPORT_EMAIL}' style='color:#38bdf8;text-decoration:none;'>Reach out to our team</a>.</p>"
        f"    <a href='{APP_URL}' style='display:inline-block;padding:15px 32px;border-radius:18px;background:linear-gradient(135deg,#22d3ee,#6366f1);color:#0f172a;font-weight:700;text-decoration:none;letter-spacing:0.02em;'>Open {APP_NAME}</a>"
        "  </td>"
        "</tr>"
    )

    html = _wrap_html(_brand_block("Security notification") + body)
    return plain, html


def render_welcome_email(username: str) -> Tuple[str, str]:
    greeting = f"Welcome, {username}!" if username else "Welcome to TuChati!"

    plain = (
        f"{APP_NAME}\n{APP_URL}\n\n"
        f"{greeting}\n\n"
        "Your workspace is ready. Here are a few quick wins:\n"
        "• Personalise your profile so teammates recognise you.\n"
        "• Start or join rooms to keep conversations organised.\n"
        "• Invite teammates directly from the app.\n\n"
        f"Questions? We’re here at {SUPPORT_EMAIL}.\n\n"
        f"— The {APP_NAME} team\n"
    )

    body = (
        "<tr>"
        "  <td style='padding:40px 48px;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(14,116,144,0.05));'>"
        "    <h1 style='margin:0;font-size:30px;color:#f8fafc;letter-spacing:-0.03em;'>"
        f"      {greeting}"
        "    </h1>"
        "    <p style='margin:18px 0 26px;font-size:17px;color:#dbeafe;line-height:1.8;'>We’re excited to have you onboard. Here’s how to get started today:</p>"
        "    <ul style='margin:0 0 28px 22px;padding:0;color:#cbd5f5;font-size:15px;line-height:1.8;'>"
        "      <li>Set your display photo and status to let teammates know it’s you.</li>"
        "      <li>Create rooms for your projects or communities and invite collaborators.</li>"
        "      <li>Secure your account with two-factor verification from settings.</li>"
        "    </ul>"
        f"    <a href='{APP_URL}' style='display:inline-block;padding:14px 30px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#f8fafc;text-decoration:none;font-weight:700;letter-spacing:0.02em;'>Open {APP_NAME}</a>"
        "  </td>"
        "</tr>"
        "<tr>"
        "  <td style='padding:26px 48px 44px;color:#94a3b8;font-size:14px;background:#0b1220;'>"
        f"    <p style='margin:0 0 14px;'>Questions? Reply to this email or reach us at <a href='mailto:{SUPPORT_EMAIL}' style='color:#38bdf8;text-decoration:none;'>{SUPPORT_EMAIL}</a>.</p>"
        "    <p style='margin:0;font-size:13px;color:#64748b;'>Stay connected. Collaborate with your team. Welcome to the future of messaging.</p>"
        "  </td>"
        "</tr>"
    )

    html = _wrap_html(_brand_block("Welcome aboard") + body)
    return plain, html

__all__ = [
    "render_verification_email",
    "render_welcome_email",
    "APP_NAME",
    "SUPPORT_EMAIL",
]

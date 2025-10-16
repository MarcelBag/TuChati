from __future__ import annotations

import logging
import random
from datetime import timedelta
from email.utils import parseaddr

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import EmailVerificationCode
from ..utils import DEFAULT_FROM

User = get_user_model()
logger = logging.getLogger(__name__)

VERIFICATION_TTL_SECONDS = 60
POST_VERIFY_TTL_SECONDS = 300

APP_NAME = getattr(settings, "APP_BRAND_NAME", "TuChati")
APP_URL = getattr(settings, "APP_BRAND_URL", "https://tuchati.tuunganes.com")
APP_SUPPORT = getattr(settings, "APP_SUPPORT_EMAIL", DEFAULT_FROM)
APP_SUPPORT_ADDR = parseaddr(APP_SUPPORT)[1] or APP_SUPPORT


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _send_email(email: str, subject: str, text: str, html: str | None = None) -> bool:
    try:
        msg = EmailMultiAlternatives(subject, text, DEFAULT_FROM, [email])
        if html:
            msg.attach_alternative(html, "text/html")
        msg.send()
        return True
    except Exception:
        logger.exception("Failed to send %s email to %s", subject, email)
        return False


def _build_email_shell(inner_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang='en'>
  <head>
    <meta charset='utf-8'/>
    <meta name='viewport' content='width=device-width, initial-scale=1'/>
    <title>{APP_NAME}</title>
  </head>
  <body style="margin:0;background:#0f172a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
    <table role='presentation' cellpadding='0' cellspacing='0' width='100%' style='padding:32px 0;'>
      <tr>
        <td align='center'>
          <table role='presentation' width='560' cellpadding='0' cellspacing='0' style='width:560px;max-width:100%;background:#0b1222;border-radius:24px;box-shadow:0 18px 60px rgba(15,23,42,0.35);overflow:hidden;border:1px solid rgba(148,163,184,0.12);'>
            <tr>
              <td style='padding:32px 40px;'>
                {inner_html}
              </td>
            </tr>
          </table>
          <p style='margin:24px 0 0;font-size:12px;color:#64748b;'>© {APP_NAME}. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _format_code_email(username: str, code: str, purpose: str) -> tuple[str, str]:
    greeting = f"Hi {username}," if username else "Hello,"
    plain = (
        f"{APP_NAME}\n{APP_URL}\n\n"
        f"{greeting}\n\n"
        f"Here is your {APP_NAME} verification code to {purpose}:\n\n"
        f"{code}\n\n"
        "This code expires in 60 seconds.\n\n"
        "If this wasn’t you, please reset your password immediately.\n\n"
        "If you didn’t request this, you can safely ignore this email.\n"
        f"— Your {APP_NAME} team"
    )

    html_inner = f"""
      <div style='display:flex;align-items:center;gap:12px;margin-bottom:28px;'>
        <div style='background:linear-gradient(135deg,#22d3ee,#6366f1);width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#0b1222;'>{APP_NAME[:2].upper()}</div>
        <div>
          <p style='margin:0;font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#f8fafc;'>{APP_NAME}</p>
          <a href='{APP_URL}' style='color:#38bdf8;text-decoration:none;font-size:14px;'>{APP_URL}</a>
        </div>
      </div>
      <p style='margin:0 0 8px;font-size:16px;color:#cbd5f5;'>{greeting}</p>
      <p style='margin:0 0 24px;font-size:16px;color:#a5b4fc;line-height:1.6;'>Here is your verification code to {purpose}. Enter it in the TuChati window—this code expires in <strong>60 seconds</strong>.</p>
      <div style='background:#111b33;border:1px solid rgba(148,163,184,0.18);border-radius:18px;padding:20px 12px;margin:24px 0;text-align:center;letter-spacing:0.6rem;font-size:32px;font-weight:700;color:#f8fafc;'>{code}</div>
      <p style='margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6;'>If this wasn’t you, <a href='{APP_URL}/settings/account' style='color:#38bdf8;'>reset your password</a> immediately.</p>
      <p style='margin:0 0 32px;font-size:13px;color:#64748b;line-height:1.6;'>Need help? Contact us at <a href='mailto:{APP_SUPPORT_ADDR}' style='color:#38bdf8;'>{APP_SUPPORT_ADDR}</a>.</p>
      <p style='margin:0;font-size:13px;color:#4f6b95;'>— Your {APP_NAME} team</p>
    """

    return plain, _build_email_shell(html_inner)


def _format_welcome_email(username: str) -> tuple[str, str]:
    greeting = f"Welcome, {username}!" if username else "Welcome!"
    plain = (
        f"{APP_NAME}\n{APP_URL}\n\n"
        f"{greeting}\n\n"
        "Your account is ready. Here are a few quick tips to get started:\n"
        "• Add your profile photo and bio so teammates recognise you.\n"
        "• Invite teammates to your rooms and keep conversations organised.\n"
        "• Turn on two-factor protections to stay secure.\n\n"
        f"We’re excited to have you onboard.\n— The {APP_NAME} team"
    )

    html_inner = f"""
      <div style='display:flex;align-items:center;gap:12px;margin-bottom:28px;'>
        <div style='background:linear-gradient(135deg,#6366f1,#8b5cf6);width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#f8fafc;'>{APP_NAME[:2].upper()}</div>
        <div>
          <p style='margin:0;font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#f8fafc;'>{APP_NAME}</p>
          <a href='{APP_URL}' style='color:#c4b5fd;text-decoration:none;font-size:14px;'>{APP_URL}</a>
        </div>
      </div>
      <h1 style='margin:0 0 16px;font-size:28px;color:#f8fafc;letter-spacing:-0.02em;'>{greeting}</h1>
      <p style='margin:0 0 20px;font-size:16px;color:#cbd5f5;line-height:1.7;'>Your TuChati workspace is live. Here’s how to make the most of it:</p>
      <ul style='margin:0 0 24px 20px;padding:0;color:#a5b4fc;font-size:15px;line-height:1.7;'>
        <li>Add a profile photo so teammates recognise you.</li>
        <li>Create or join rooms to stay in sync with your community.</li>
        <li>Enable two-factor security to keep your account safe.</li>
      </ul>
      <a href='{APP_URL}' style='display:inline-block;padding:14px 28px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#6366f1);color:#0b1222;font-weight:700;text-decoration:none;letter-spacing:0.02em;'>Open TuChati</a>
      <p style='margin:32px 0 0;font-size:13px;color:#64748b;'>We’re here if you need a hand—just reply to this email.</p>
      <p style='margin:12px 0 0;font-size:13px;color:#4f6b95;'>— The {APP_NAME} team</p>
    """

    return plain, _build_email_shell(html_inner)


class RegisterStartView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        username = (request.data.get('username') or '').strip()

        if not email or not username:
            return Response({"detail": "Email and username are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_email(email)
        except ValidationError:
            return Response({"detail": "Invalid email address."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Email is already registered."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)

        EmailVerificationCode.objects.filter(
            email=email,
            purpose=EmailVerificationCode.PURPOSE_SIGNUP,
            used=False,
        ).delete()

        code = _generate_code()
        record = EmailVerificationCode.objects.create(
            email=email,
            username=username,
            purpose=EmailVerificationCode.PURPOSE_SIGNUP,
            code=code,
            expires_at=timezone.now() + timedelta(seconds=VERIFICATION_TTL_SECONDS),
            metadata={"username": username},
        )

        text_body, html_body = _format_code_email(username or email, code, "finish creating your TuChati account")
        sent = _send_email(email, f"{APP_NAME} verification code", text_body, html_body)
        if not sent and not getattr(settings, "DEBUG", False):
            record.delete()
            return Response(
                {"detail": "Unable to send verification email. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not sent:
            logger.warning("Verification email send failed for %s but continuing because DEBUG is True", email)

        return Response(
            {
                "detail": "Verification code sent.",
                "verification_id": str(record.id),
                "expires_in": VERIFICATION_TTL_SECONDS,
            }
        )


class RegisterVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        verification_id = request.data.get('verification_id')
        code = (request.data.get('code') or '').strip()

        if not verification_id or not code:
            return Response({"detail": "Verification id and code are required."}, status=status.HTTP_400_BAD_REQUEST)

        record = get_object_or_404(EmailVerificationCode, id=verification_id, purpose=EmailVerificationCode.PURPOSE_SIGNUP)

        if record.used:
            return Response({"detail": "Verification already used."}, status=status.HTTP_400_BAD_REQUEST)

        if record.is_expired:
            return Response({"detail": "Verification code expired."}, status=status.HTTP_400_BAD_REQUEST)

        if record.code != code:
            record.attempts += 1
            record.save(update_fields=['attempts'])
            return Response({"detail": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)

        record.verified_at = timezone.now()
        record.expires_at = timezone.now() + timedelta(seconds=POST_VERIFY_TTL_SECONDS)
        record.save(update_fields=['verified_at', 'expires_at'])

        return Response(
            {
                "detail": "Email verified.",
                "verification_id": str(record.id),
                "expires_in": POST_VERIFY_TTL_SECONDS,
            }
        )


class RegisterCompleteView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        verification_id = request.data.get('verification_id')
        code = (request.data.get('code') or '').strip()
        password = request.data.get('password') or request.data.get('new_password')

        if not verification_id or not password:
            return Response({"detail": "Verification id and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        record = get_object_or_404(EmailVerificationCode, id=verification_id, purpose=EmailVerificationCode.PURPOSE_SIGNUP)

        if record.used:
            return Response({"detail": "Verification already used."}, status=status.HTTP_400_BAD_REQUEST)

        if record.is_expired:
            return Response({"detail": "Verification code expired."}, status=status.HTTP_400_BAD_REQUEST)

        if code and record.code != code:
            record.attempts += 1
            record.save(update_fields=['attempts'])
            return Response({"detail": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)

        if record.verified_at is None:
            return Response({"detail": "Email not verified yet."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            password_validation.validate_password(password)
        except ValidationError as exc:
            return Response({"password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        email = record.email
        username = record.username or (record.metadata or {}).get('username')
        if not username:
            return Response({"detail": "Missing username."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Email is already registered."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )

        record.mark_used()

        welcome_text, welcome_html = _format_welcome_email(username)
        if not _send_email(email, f"Welcome to {APP_NAME}", welcome_text, welcome_html):
            logger.warning("Account created for %s but welcome email failed", email)

        return Response({"detail": "Account created. You can now log in."}, status=status.HTTP_201_CREATED)


class PasswordResetStartView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = (request.data.get('identifier') or request.data.get('email') or request.data.get('username') or '').strip()
        if not identifier:
            return Response({"detail": "Provide your email or username."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if '@' in identifier:
                user = User.objects.get(email__iexact=identifier)
            else:
                user = User.objects.get(username__iexact=identifier)
        except User.DoesNotExist:
            # Respond generically to avoid leaking account existence
            return Response({"detail": "If that account exists, we sent reset instructions."})

        EmailVerificationCode.objects.filter(
            user=user,
            purpose=EmailVerificationCode.PURPOSE_PASSWORD_RESET,
            used=False,
        ).delete()

        code = _generate_code()
        record = EmailVerificationCode.objects.create(
            email=user.email,
            user=user,
            username=user.username,
            purpose=EmailVerificationCode.PURPOSE_PASSWORD_RESET,
            code=code,
            expires_at=timezone.now() + timedelta(seconds=VERIFICATION_TTL_SECONDS),
            metadata={'user_id': user.id},
        )

        text_body, html_body = _format_code_email(
            user.username or user.email,
            code,
            "reset your password",
        )
        sent = _send_email(user.email, f"{APP_NAME} password reset", text_body, html_body)
        if not sent and not getattr(settings, "DEBUG", False):
            record.delete()
            return Response(
                {"detail": "Unable to send verification email. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not sent:
            logger.warning("Password reset email send failed for %s but continuing because DEBUG is True", user.email)

        return Response(
            {
                "detail": "Verification code sent.",
                "verification_id": str(record.id),
                "expires_in": VERIFICATION_TTL_SECONDS,
            }
        )


class PasswordResetVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        verification_id = request.data.get('verification_id')
        code = (request.data.get('code') or '').strip()

        if not verification_id or not code:
            return Response({"detail": "Verification id and code are required."}, status=status.HTTP_400_BAD_REQUEST)

        record = get_object_or_404(EmailVerificationCode, id=verification_id, purpose=EmailVerificationCode.PURPOSE_PASSWORD_RESET)

        if record.used:
            return Response({"detail": "Verification already used."}, status=status.HTTP_400_BAD_REQUEST)

        if record.is_expired:
            return Response({"detail": "Verification code expired."}, status=status.HTTP_400_BAD_REQUEST)

        if record.code != code:
            record.attempts += 1
            record.save(update_fields=['attempts'])
            return Response({"detail": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)

        record.verified_at = timezone.now()
        record.expires_at = timezone.now() + timedelta(seconds=POST_VERIFY_TTL_SECONDS)
        record.save(update_fields=['verified_at', 'expires_at'])

        return Response(
            {
                "detail": "Verification code accepted.",
                "verification_id": str(record.id),
                "expires_in": POST_VERIFY_TTL_SECONDS,
            }
        )


class PasswordResetCompleteView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        verification_id = request.data.get('verification_id')
        code = (request.data.get('code') or '').strip()
        password = request.data.get('password') or request.data.get('new_password')

        if not verification_id or not password:
            return Response({"detail": "Verification id and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        record = get_object_or_404(EmailVerificationCode, id=verification_id, purpose=EmailVerificationCode.PURPOSE_PASSWORD_RESET)

        if record.used:
            return Response({"detail": "Verification already used."}, status=status.HTTP_400_BAD_REQUEST)

        if record.is_expired:
            return Response({"detail": "Verification code expired."}, status=status.HTTP_400_BAD_REQUEST)

        if code and record.code != code:
            record.attempts += 1
            record.save(update_fields=['attempts'])
            return Response({"detail": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)

        if record.verified_at is None:
            return Response({"detail": "Verification code not confirmed yet."}, status=status.HTTP_400_BAD_REQUEST)

        user = record.user
        if not user:
            try:
                user = User.objects.get(email__iexact=record.email)
            except User.DoesNotExist:
                return Response({"detail": "Account not found."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            password_validation.validate_password(password, user=user)
        except ValidationError as exc:
            return Response({"password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])

        record.mark_used()

        return Response({"detail": "Password updated successfully."})

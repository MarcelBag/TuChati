from __future__ import annotations

import logging
import random
from datetime import timedelta

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
from .email_templates import APP_NAME, render_verification_email, render_welcome_email

User = get_user_model()
logger = logging.getLogger(__name__)

VERIFICATION_TTL_SECONDS = 60
POST_VERIFY_TTL_SECONDS = 300

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

        text_body, html_body = render_verification_email(
            username or email,
            code,
            "finish creating your TuChati account",
            VERIFICATION_TTL_SECONDS,
        )
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

        welcome_text, welcome_html = render_welcome_email(username)
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

        text_body, html_body = render_verification_email(
            user.username or user.email,
            code,
            "reset your password",
            VERIFICATION_TTL_SECONDS,
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

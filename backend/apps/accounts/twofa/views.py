from __future__ import annotations

import logging
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.utils import timezone
from django.conf import settings
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


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _send_email(email: str, subject: str, message: str) -> bool:
    try:
        send_mail(subject, message, DEFAULT_FROM, [email], fail_silently=False)
        return True
    except Exception:
        logger.exception("Failed to send %s email to %s", subject, email)
        return False


def _format_code_email(username: str, code: str) -> str:
    return (
        "TuChati\n"
        "tuchati.tuunganes.com\n"
        f"{username}/\n\n"
        "TuChati.tuunganes.com\n\n"
        f"Verification code: {code}\n\n"
        "If this wasn’t you, please reset your password immediately.\n\n"
        "If you didn’t request this, you can safely ignore this email.\n"
        "Your TuChati team"
    )


def _format_welcome_email(username: str) -> str:
    return (
        "TuChati\n"
        "tuchati.tuunganes.com\n\n"
        f"Welcome {username}!\n\n"
        "Your account is all set. Keep your account secure by enabling two-factor options when available."
    )


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

        message = _format_code_email(username or email, code)
        sent = _send_email(email, "TuChati verification code", message)
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

        welcome_msg = _format_welcome_email(username)
        if not _send_email(email, "Welcome to TuChati", welcome_msg):
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

        message = _format_code_email(user.username or user.email, code)
        sent = _send_email(user.email, "TuChati password reset", message)
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

# backend/apps/accounts/views.py
from rest_framework import generics, permissions, status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q

from .serializers import (
    RegisterSerializer,
    UserSerializer, UserUpdateSerializer, MePayloadSerializer,
    PasswordChangeSerializer,
    DeviceSessionSerializer,
)
from .models import DeviceSession

User = get_user_model()


def initials(first_name: str, last_name: str, username: str) -> str:
    a = (first_name or '').strip()[:1]
    b = (last_name or '').strip()[:1]
    if a or b:
        return (a + b).upper()
    return (username or '?')[:2].upper()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

class MeView(APIView):
    """
    GET    -> full profile payload (MePayloadSerializer)
    PATCH  -> partial update of profile fields (no username)
    PUT    -> full update (same set as PATCH)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MePayloadSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        ser = UserUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(MePayloadSerializer(request.user, context={"request": request}).data)

    def put(self, request):
        ser = UserUpdateSerializer(request.user, data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(MePayloadSerializer(request.user, context={"request": request}).data)


class PresenceView(APIView):
    """
    POST /api/accounts/me/presence/
    Body: { "current_status": "online|away|offline|dnd", "status_message": "...", "user_timezone": "Africa/Dar_es_Salaam" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        allowed = {"online", "away", "offline", "dnd"}
        status_val = request.data.get("current_status")
        if status_val and status_val in allowed:
            user.current_status = status_val
        if "status_message" in request.data:
            user.status_message = request.data.get("status_message") or ""
            user.status_updated_at = timezone.now()
        if "user_timezone" in request.data:
            user.user_timezone = request.data.get("user_timezone") or user.user_timezone
        user.last_seen = timezone.now()
        user.save(update_fields=["current_status", "status_message", "status_updated_at", "user_timezone", "last_seen"])
        return Response({"detail": "Presence updated."}, status=status.HTTP_200_OK)


class AvatarUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        ser = UserUpdateSerializer(request.user, data={"avatar": request.data.get("avatar")}, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = PasswordChangeSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"detail": "Password changed."}, status=status.HTTP_200_OK)
class SessionsView(APIView):
    """
    GET    /api/accounts/sessions/                 -> list sessions
    DELETE /api/accounts/sessions/<uuid:id>/      -> revoke one
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, session_id=None):
        qs = DeviceSession.objects.filter(user=request.user, is_active=True).order_by("-last_active")
        ser = DeviceSessionSerializer(qs, many=True, context={"request": request})
        return Response(ser.data)

    def delete(self, request, session_id=None):
        if not session_id:
            return Response({"detail": "Session id required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            sess = DeviceSession.objects.get(id=session_id, user=request.user, is_active=True)
        except DeviceSession.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        sess.is_active = False
        sess.mark_offline()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current_token = (request.META.get("HTTP_AUTHORIZATION") or "")[7:]  # strip "Bearer "
        DeviceSession.objects.filter(user=request.user, is_active=True).exclude(token=current_token).update(is_active=False)
        return Response({"detail": "Logged out from all other devices."}, status=status.HTTP_200_OK)


class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            return Response([], status=status.HTTP_200_OK)

        qs = (
            User.objects.filter(
                Q(username__icontains=query) |
                Q(email__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query)
            )
            .exclude(id=request.user.id)
            .order_by('username')[:25]
        )

        data = [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email if user.share_contact_info or user == request.user else None,
                "phone": user.phone if user.share_contact_info or user == request.user else None,
                "name": (user.get_full_name() or user.username),
                "avatar": user.avatar.url if user.avatar and (user.share_avatar or user == request.user) else None,
            }
            for user in qs
        ]

        return Response(data, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _resolve_user(self, identifier: str):
        try:
            return User.objects.get(uuid=identifier)
        except (User.DoesNotExist, ValueError):
            pass
        if identifier.isdigit():
            try:
                return User.objects.get(id=int(identifier))
            except User.DoesNotExist:
                pass
        try:
            return User.objects.get(username=identifier)
        except User.DoesNotExist:
            return get_object_or_404(User, username=identifier)

    def get(self, request, identifier: str):
        user = self._resolve_user(identifier)
        viewer = request.user
        is_self = viewer == user

        def allow(field: str) -> bool:
            return is_self or getattr(user, field)

        avatar_url = user.avatar.url if user.avatar and allow('share_avatar') else None
        bio = user.bio if allow('share_bio') else ''
        status_message = user.status_message if allow('share_status_message') else ''
        current_status = user.current_status if allow('share_status_message') else ''
        email = user.email if allow('share_contact_info') else ''
        phone = user.phone if allow('share_contact_info') else ''
        last_seen = user.last_seen if allow('share_last_seen') else None
        timezone_value = user.user_timezone if allow('share_timezone') else ''

        payload = {
            "id": user.id,
            "uuid": str(user.uuid),
            "username": user.username,
            "display_name": user.get_full_name() or user.username,
            "initials": initials(user.first_name, user.last_name, user.username),
            "avatar": avatar_url,
            "bio": bio,
            "status_message": status_message,
            "current_status": current_status,
            "last_seen": last_seen,
            "phone": phone,
            "email": email,
            "user_timezone": timezone_value,
            "is_online": user.is_online,
            "privacy": {
                "share_avatar": user.share_avatar,
                "share_contact_info": user.share_contact_info,
                "share_bio": user.share_bio,
                "share_last_seen": user.share_last_seen,
                "share_status_message": user.share_status_message,
                "share_timezone": user.share_timezone,
                "auto_accept_group_invites": user.auto_accept_group_invites,
            },
            "viewer_is_self": is_self,
        }

        return Response(payload, status=status.HTTP_200_OK)

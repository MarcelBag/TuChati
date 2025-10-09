# backend/apps/accounts/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.utils import timezone

from .serializers import (
    RegisterSerializer,
    UserSerializer, UserUpdateSerializer, MePayloadSerializer,
    PasswordChangeSerializer,
    DeviceSessionSerializer,
)
from .models import DeviceSession

User = get_user_model()


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

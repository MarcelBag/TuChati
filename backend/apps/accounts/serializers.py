# backend/apps/accounts/serializers.
from rest_framework import serializers
from django.contrib.auth import get_user_model, password_validation
from django.utils import timezone
from .models import DeviceSession

User = get_user_model()

# Small helpers
def _initials(first_name: str, last_name: str, username: str) -> str:
    a = (first_name or "").strip()[:1]
    b = (last_name or "").strip()[:1]
    if a or b:
        return (a + b).upper()
    return (username or "?")[:2].upper()

# Core user serializers

class UserSerializer(serializers.ModelSerializer):
    # Computed helpers that are convenient for the UI
    has_avatar = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "uuid", "email", "username",
            "first_name", "last_name",
            "avatar", "has_avatar", "initials",
            # presence / profile
            "is_online", "current_status", "last_seen", "device_type",
            "phone", "bio", "status_message", "status_updated_at", "user_timezone",
            "share_avatar", "share_contact_info", "share_bio", "share_last_seen", "share_status_message",
        ]
        read_only_fields = ["id", "username", "is_online", "uuid", "last_seen", "status_updated_at"]

    def get_has_avatar(self, obj):
        return bool(obj.avatar)

    def get_initials(self, obj):
        return _initials(obj.first_name, obj.last_name, obj.username)


class UserUpdateSerializer(serializers.ModelSerializer):
    """Used by PATCH/PUT /me/ and avatar upload (partial)."""
    class Meta:
        model = User
        fields = [
            "first_name", "last_name", "email", "avatar", "phone", "bio", "status_message", "user_timezone",
            "share_avatar", "share_contact_info", "share_bio", "share_last_seen", "share_status_message",
        ]


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Incorrect password."})
        password_validation.validate_password(attrs["new_password"], user=user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[password_validation.validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ["email", "username", "password", "password2"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        return User.objects.create_user(**validated_data)

# Sessions

class DeviceSessionSerializer(serializers.ModelSerializer):
    current = serializers.SerializerMethodField()
    device = serializers.SerializerMethodField()
    last_seen = serializers.DateTimeField(read_only=True)

    class Meta:
        model = DeviceSession
        fields = [
            "id", "device_type", "device_name", "ip_address",
            "created_at", "last_active", "last_seen",
            "connection_status", "current", "device",
        ]

    def get_current(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        bearer = (request.META.get("HTTP_AUTHORIZATION") or "")[7:]
        return bearer == obj.token

    def get_device(self, obj):
        return obj.device_name or obj.device_type


# having a richer “Me” payload wrapper

class MePayloadSerializer(UserSerializer):
    sessions_summary = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ["sessions_summary"]

    def get_sessions_summary(self, obj):
        # tiny cheap summary for the header/profile:
        qs = DeviceSession.objects.filter(user=obj, is_active=True)
        total = qs.count()
        last = qs.order_by("-last_active").first()
        return {
            "active": total,
            "last_active": last.last_active if last else None,
            "last_device": (last.device_name or last.device_type) if last else None,
        }

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Role, AuditEvent

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
        source="users",
    )

    class Meta:
        model = Role
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "permissions",
            "user_ids",
            "is_system",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("is_system", "created_at", "updated_at")


class RoleUpdateSerializer(serializers.ModelSerializer):
    user_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False
    )

    class Meta:
        model = Role
        fields = (
            "name",
            "slug",
            "description",
            "permissions",
            "user_ids",
        )

    def create(self, validated_data):
        user_ids = validated_data.pop("user_ids", None)
        role = super().create(validated_data)
        if user_ids:
            users = list(User.objects.filter(id__in=user_ids))
            role.users.set(users)
        return role

    def update(self, instance, validated_data):
        user_ids = validated_data.pop("user_ids", None)
        previous_user_ids = set(instance.users.values_list("id", flat=True))
        role = super().update(instance, validated_data)
        if user_ids is not None:
            users = list(User.objects.filter(id__in=user_ids))
            role.users.set(users)
            affected_ids = previous_user_ids.union({user.id for user in users})
            for user in User.objects.filter(id__in=affected_ids):
                if hasattr(user, "admin_permissions_cache"):
                    delattr(user, "admin_permissions_cache")
        return role


class AuditEventSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = (
            "id",
            "event_type",
            "message",
            "severity",
            "target",
            "metadata",
            "created_at",
            "actor",
        )

    def get_actor(self, obj: AuditEvent):
        if not obj.actor_id:
            return None
        return {
            "id": obj.actor_id,
            "username": getattr(obj.actor, "username", None),
            "name": getattr(obj.actor, "get_full_name", lambda: "")()
            or getattr(obj.actor, "username", ""),
        }


class AdminUserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "last_login",
            "roles",
        )

    def get_roles(self, user):
        return list(user.admin_roles.values_list("name", flat=True))

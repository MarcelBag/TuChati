from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.exceptions import PermissionDenied

from apps.chat.models import ChatRoom
from .models import Role, AuditEvent
from .permissions import AdminPermission, HasAdminPermission
from .serializers import (
    RoleSerializer,
    RoleUpdateSerializer,
    AuditEventSerializer,
    AdminUserSerializer,
)

User = get_user_model()


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasAdminPermission]
    permission_required = AdminPermission.MANAGE_ROLES

    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ("name", "slug", "description")
    ordering = ("name",)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RoleUpdateSerializer
        return super().get_serializer_class()

    def log_audit(self, request, event_type: str, message: str, metadata: dict | None = None):
        AuditEvent.objects.create(
            event_type=event_type,
            message=message,
            metadata=metadata or {},
            actor=request.user,
            target="role",
        )

    def perform_create(self, serializer):
        role = serializer.save()
        self.log_audit(self.request, "role.created", f"Created role {role.name}", {"role_id": str(role.id)})

    def perform_update(self, serializer):
        role = serializer.save()
        self.log_audit(self.request, "role.updated", f"Updated role {role.name}", {"role_id": str(role.id)})

    def perform_destroy(self, instance):
        if instance.is_system:
            raise PermissionDenied("System roles cannot be deleted")
        role_name = instance.name
        role_id = str(instance.id)
        super().perform_destroy(instance)
        self.log_audit(
            self.request,
            "role.deleted",
            f"Deleted role {role_name}",
            {"role_id": role_id},
        )

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        roles = request.user.admin_roles.all()
        serializer = RoleSerializer(roles, many=True)
        permissions = set()
        for role in roles:
            permissions.update(role.permissions)
        if request.user.is_staff or request.user.is_superuser:
            permissions.update(
                [
                    AdminPermission.MANAGE_USERS,
                    AdminPermission.MANAGE_ROLES,
                    AdminPermission.VIEW_AUDIT,
                    AdminPermission.VIEW_HEALTH,
                    AdminPermission.VIEW_USERS,
                ]
            )
        return Response(
            {
                "roles": serializer.data,
                "permissions": sorted(list(permissions)),
                "is_staff": request.user.is_staff,
                "is_superuser": request.user.is_superuser,
            }
        )


class AuditEventViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AuditEventSerializer
    permission_classes = [IsAuthenticated, HasAdminPermission]
    permission_required = AdminPermission.VIEW_AUDIT
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ("event_type", "severity")
    ordering_fields = ("created_at",)
    ordering = ("-created_at",)
    search_fields = ("message", "target", "metadata")

    def get_queryset(self):
        return AuditEvent.objects.select_related("actor")


class AdminUserViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, HasAdminPermission]
    permission_required = AdminPermission.MANAGE_USERS
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ("username", "email")
    ordering = ("username",)

    def get_permission_required(self, request):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return AdminPermission.VIEW_USERS
        return self.permission_required

    def get_queryset(self):
        queryset = (
            User.objects.all()
            .prefetch_related("admin_roles")
            .only("id", "username", "email", "is_staff", "is_superuser", "last_login")
        )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(username__icontains=search) | Q(email__icontains=search))
        return queryset


class MetricsView(APIView):
    permission_classes = [IsAuthenticated, HasAdminPermission]
    permission_required = AdminPermission.VIEW_HEALTH

    def get(self, request):
        today = timezone.now().date()
        total_users = User.objects.count()
        staff_users = User.objects.filter(is_staff=True).count()
        superusers = User.objects.filter(is_superuser=True).count()
        active_today = User.objects.filter(last_login__date=today).count()
        total_rooms = ChatRoom.objects.count()
        total_roles = Role.objects.count()

        recent_events = [
            {
                "id": str(event.id),
                "event_type": event.event_type,
                "message": event.message,
                "severity": event.severity,
                "created_at": event.created_at,
            }
            for event in AuditEvent.objects.order_by("-created_at")[:5]
        ]

        top_roles = [
            {
                "id": str(role.id),
                "name": role.name,
                "user_count": role.user_count,
            }
            for role in Role.objects.annotate(user_count=Count("users"))
            .order_by("-user_count")[:5]
        ]

        latest_users = [
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "date_joined": user.date_joined,
            }
            for user in User.objects.order_by("-date_joined")[:5]
        ]

        return Response(
            {
                "stats": {
                    "total_users": total_users,
                    "staff_users": staff_users,
                    "superusers": superusers,
                    "active_today": active_today,
                    "total_rooms": total_rooms,
                    "total_roles": total_roles,
                },
                "recent_events": recent_events,
                "top_roles": top_roles,
                "latest_users": latest_users,
            }
        )

from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.exceptions import PermissionDenied

from .models import Role, AuditEvent
from .permissions import AdminPermission, HasAdminPermission
from .serializers import RoleSerializer, RoleUpdateSerializer, AuditEventSerializer


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasAdminPermission]
    permission_required = AdminPermission.MANAGE_ROLES

    def get_permission_required(self, request):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return AdminPermission.MANAGE_USERS
        return self.permission_required
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ("name", "slug", "description")
    ordering = ("name",)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RoleUpdateSerializer
        return super().get_serializer_class()

    def get_permission_required(self, request):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return AdminPermission.MANAGE_USERS
        return self.permission_required

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
        return Response(
            {
                "roles": serializer.data,
                "permissions": sorted(list(permissions)),
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

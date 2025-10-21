from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    RoleViewSet,
    AuditEventViewSet,
    AdminUserViewSet,
    MetricsView,
)

router = DefaultRouter()
router.register(r"roles", RoleViewSet, basename="admin-roles")
router.register(r"audit-events", AuditEventViewSet, basename="admin-audit-events")
router.register(r"users", AdminUserViewSet, basename="admin-users")

urlpatterns = [
    path("", include(router.urls)),
    path("metrics/", MetricsView.as_view(), name="admin-metrics"),
]

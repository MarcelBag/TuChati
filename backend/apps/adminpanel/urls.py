from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import RoleViewSet, AuditEventViewSet

router = DefaultRouter()
router.register(r"roles", RoleViewSet, basename="admin-roles")
router.register(r"audit-events", AuditEventViewSet, basename="admin-audit-events")

urlpatterns = [
    path("", include(router.urls)),
]

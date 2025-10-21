from __future__ import annotations

from typing import Iterable

from rest_framework.permissions import BasePermission

ADMIN_PERMISSION_HEADER = "X-Tuchati-Admin-Permission"


class AdminPermission:
    MANAGE_USERS = "admin_center.manage_users"
    MANAGE_ROLES = "admin_center.manage_roles"
    VIEW_AUDIT = "admin_center.view_audit"
    VIEW_HEALTH = "admin_center.view_health"
    VIEW_USERS = "admin_center.view_users"

    DEFAULT_OWNER = [
        MANAGE_USERS,
        MANAGE_ROLES,
        VIEW_AUDIT,
        VIEW_HEALTH,
        VIEW_USERS,
    ]
    DEFAULT_OPERATIONS = [
        MANAGE_USERS,
        VIEW_AUDIT,
        VIEW_HEALTH,
        VIEW_USERS,
    ]
    DEFAULT_MODERATOR = [
        MANAGE_USERS,
        VIEW_AUDIT,
        VIEW_USERS,
    ]
    DEFAULT_SUPPORT = [
        VIEW_AUDIT,
        VIEW_USERS,
    ]


def user_has_permission(user, permission: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    perms: Iterable[str] = getattr(user, "admin_permissions_cache", None)
    if perms is None:
        perms = set(
            perm
            for role in getattr(user, "admin_roles", []).all()
            for perm in role.permissions
        )
        user.admin_permissions_cache = perms
    return permission in perms


class HasAdminPermission(BasePermission):
    """
    DRF permission that checks for a specific admin permission code.
    Views can specify `permission_required` and we also honor the custom header
    for ad-hoc checks.
    """

    required_permission: str | None = None

    def has_permission(self, request, view):
        permission = self.required_permission or getattr(
            view, "permission_required", None
        )
        dynamic_getter = getattr(view, "get_permission_required", None)
        if callable(dynamic_getter):
            permission = dynamic_getter(request) or permission
        if not permission:
            header_permission = request.headers.get(ADMIN_PERMISSION_HEADER)
            if not header_permission:
                return request.user.is_authenticated and request.user.is_staff
            return user_has_permission(request.user, header_permission)
        return user_has_permission(request.user, permission)

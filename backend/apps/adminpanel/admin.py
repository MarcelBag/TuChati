from django.contrib import admin

from .models import Role, AuditEvent


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_system", "updated_at")
    search_fields = ("name", "slug", "description")
    filter_horizontal = ("users",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "severity", "actor", "target", "created_at")
    list_filter = ("severity", "event_type", "created_at")
    search_fields = ("event_type", "message", "target", "metadata")
    readonly_fields = ("created_at",)

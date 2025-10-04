from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User
@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (("Two-Factor Auth", {"fields": ("is_2fa_enabled", "totp_secret")}),)
    readonly_fields = ("totp_secret",)

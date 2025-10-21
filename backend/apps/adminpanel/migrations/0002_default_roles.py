from django.db import migrations
from apps.adminpanel.permissions import AdminPermission


def create_default_roles(apps, schema_editor):
    Role = apps.get_model("adminpanel", "Role")
    defaults = [
        (
            "Owner",
            "owner",
            "Full access to the admin center.",
            AdminPermission.DEFAULT_OWNER,
        ),
        (
            "Operations",
            "operations",
            "Operations team with ability to manage users and view health.",
            AdminPermission.DEFAULT_OPERATIONS,
        ),
        (
            "Moderator",
            "moderator",
            "Moderate chats and review audits.",
            AdminPermission.DEFAULT_MODERATOR,
        ),
        (
            "Support",
            "support",
            "Support staff with read-only audit access.",
            AdminPermission.DEFAULT_SUPPORT,
        ),
    ]
    for name, slug, description, permissions in defaults:
        Role.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "permissions": permissions,
                "is_system": True,
            },
        )


def delete_default_roles(apps, schema_editor):
    Role = apps.get_model("adminpanel", "Role")
    Role.objects.filter(is_system=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("adminpanel", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_default_roles, delete_default_roles),
    ]

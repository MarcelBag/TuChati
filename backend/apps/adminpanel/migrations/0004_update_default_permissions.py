from django.db import migrations
from apps.adminpanel.permissions import AdminPermission


def update_roles(apps, schema_editor):
    Role = apps.get_model("adminpanel", "Role")
    defaults = {
        "owner": AdminPermission.DEFAULT_OWNER,
        "operations": AdminPermission.DEFAULT_OPERATIONS,
        "moderator": AdminPermission.DEFAULT_MODERATOR,
        "support": AdminPermission.DEFAULT_SUPPORT,
    }
    for slug, permissions in defaults.items():
        Role.objects.filter(slug=slug, is_system=True).update(permissions=permissions)


def revert_roles(apps, schema_editor):
    # No-op rollback
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("adminpanel", "0003_rename_adminpanel_event_ty_bb8c69_idx_adminpanel__event_t_84b869_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(update_roles, revert_roles),
    ]

from django.db import migrations


def set_off(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.update(auto_accept_group_invites=False)


def reverse(apps, schema_editor):
    # On reverse, restore to True (previous behaviour)
    User = apps.get_model('accounts', 'User')
    User.objects.update(auto_accept_group_invites=True)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_alter_user_auto_accept_group_invites'),
    ]

    operations = [
        migrations.RunPython(set_off, reverse),
    ]

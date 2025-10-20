from django.db import migrations, models


def set_default_false(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.all().update(auto_accept_group_invites=False)


def revert_default(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.all().update(auto_accept_group_invites=True)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_user_auto_accept_group_invites'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='auto_accept_group_invites',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(set_default_false, revert_default),
    ]

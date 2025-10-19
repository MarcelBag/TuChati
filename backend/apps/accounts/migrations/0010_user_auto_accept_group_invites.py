from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_user_share_timezone'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='auto_accept_group_invites',
            field=models.BooleanField(default=True),
        ),
    ]

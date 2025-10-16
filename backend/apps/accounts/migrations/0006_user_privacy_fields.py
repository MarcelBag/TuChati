from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_devicesession_app_version_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='share_avatar',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='share_bio',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='share_contact_info',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='share_last_seen',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='user',
            name='share_status_message',
            field=models.BooleanField(default=True),
        ),
    ]

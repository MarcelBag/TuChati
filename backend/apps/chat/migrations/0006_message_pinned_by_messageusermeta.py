import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('chat', '0005_chatroom_admins_chatroom_description_chatroom_icon_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='message',
            name='pinned_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='pinned_messages',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='MessageUserMeta',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('starred', models.BooleanField(default=False)),
                ('note', models.TextField(blank=True)),
                ('deleted_for_me', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('message', models.ForeignKey(on_delete=models.CASCADE, related_name='user_meta', to='chat.message')),
                ('user', models.ForeignKey(on_delete=models.CASCADE, related_name='message_meta', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('message', 'user')},
            },
        ),
        migrations.AddIndex(
            model_name='messageusermeta',
            index=models.Index(fields=['user', 'starred'], name='chat_msgmeta_user_starred_idx'),
        ),
        migrations.AddIndex(
            model_name='messageusermeta',
            index=models.Index(fields=['message', 'deleted_for_me'], name='chat_msgmeta_msg_deleted_idx'),
        ),
    ]

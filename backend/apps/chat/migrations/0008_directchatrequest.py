from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0007_rename_chat_msgmeta_user_starred_idx_chat_messag_user_id_3969b1_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatroom',
            name='is_pending',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='DirectChatRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')], default='pending', max_length=16)),
                ('initial_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('from_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='direct_requests_sent', to=settings.AUTH_USER_MODEL)),
                ('room', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='direct_request', to='chat.chatroom')),
                ('to_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='direct_requests_received', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.AddConstraint(
            model_name='directchatrequest',
            constraint=models.UniqueConstraint(fields=('from_user', 'to_user', 'status'), name='unique_direct_request_status'),
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0009_remove_directchatrequest_unique_direct_request_status_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='GroupInvite',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')], default='pending', max_length=16)),
                ('message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('invitee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_invites_received', to=settings.AUTH_USER_MODEL)),
                ('inviter', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_invites_sent', to=settings.AUTH_USER_MODEL)),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_invites', to='chat.chatroom')),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.AddIndex(
            model_name='groupinvite',
            index=models.Index(fields=('invitee', 'status'), name='chat_group_invitee_status_idx'),
        ),
        migrations.AddIndex(
            model_name='groupinvite',
            index=models.Index(fields=('inviter', 'status'), name='chat_group_inviter_status_idx'),
        ),
        migrations.AddConstraint(
            model_name='groupinvite',
            constraint=models.UniqueConstraint(fields=('room', 'invitee', 'status'), name='unique_group_invite_status'),
        ),
    ]

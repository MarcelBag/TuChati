# Generated for EmailVerificationCode
from django.db import migrations, models
import uuid

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_user_privacy_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailVerificationCode',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('email', models.EmailField(max_length=254)),
                ('username', models.CharField(max_length=150, blank=True)),
                ('code', models.CharField(max_length=6)),
                ('purpose', models.CharField(max_length=32, choices=[('signup', 'Signup'), ('password_reset', 'Password reset')])),
                ('expires_at', models.DateTimeField()),
                ('verified_at', models.DateTimeField(null=True, blank=True)),
                ('used', models.BooleanField(default=False)),
                ('attempts', models.IntegerField(default=0)),
                ('metadata', models.JSONField(null=True, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(null=True, blank=True, on_delete=models.deletion.CASCADE, related_name='verification_codes', to='accounts.user')),
            ],
        ),
        migrations.AddIndex(
            model_name='emailverificationcode',
            index=models.Index(fields=['email', 'purpose'], name='accounts_em_email__2b246a_idx'),
        ),
        migrations.AddIndex(
            model_name='emailverificationcode',
            index=models.Index(fields=['user', 'purpose'], name='accounts_em_user_id_91f01a_idx'),
        ),
    ]

from django.contrib.auth.models import AbstractUser
from django.db import models
class User(AbstractUser):
    totp_secret = models.CharField(max_length=64, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)

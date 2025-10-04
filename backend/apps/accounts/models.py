#backend/apps/accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    has_2fa = models.BooleanField(default=False)
    totp_secret = models.CharField(max_length=64, blank=True, null=True)

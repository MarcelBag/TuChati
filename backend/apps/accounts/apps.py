#backend/apps/accounts/apps.py
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    verbose_name = "Accounts & Authentication"

    def ready(self):  # pragma: no cover - registration side-effect
        # Import signal handlers so device sessions are tracked whenever
        # JWT tokens are issued. The import must happen lazily during app
        # loading to avoid circular imports when Django starts up.
        from . import signals  # noqa: F401

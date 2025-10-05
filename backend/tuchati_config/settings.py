# backend/tuchati_config/settings.py
# ===========================================
# Tuchati Django Settings
# Environment-ready (dev / prod)
# ===========================================

import os
from pathlib import Path
from datetime import timedelta

# -------------------------------------------
# BASE CONFIG
# -------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "dev")
DEBUG = bool(int(os.getenv("DEBUG", "1")))

# Allow all hosts in dev; restrict in prod (use comma-separated list)
ALLOWED_HOSTS = [h for h in os.getenv("ALLOWED_HOSTS", "*").split(",") if h]


# -------------------------------------------
# INSTALLED APPS
# -------------------------------------------
INSTALLED_APPS = [
    # we will add it to requirement modern Django admin interface (install via pip install django-jazzmin)
    "jazzmin",  # must come BEFORE 'django.contrib.admin'

    # Core Django + Daphne for ASGI
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party integrations
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "channels",

    # Local apps
    "apps.accounts",
    # Chat System
    "apps.chat",
]


# -------------------------------------------
# TEMPLATE CONFIGURATION
# Enables Django admin + your future templates
# -------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # You can place global templates in backend/templates/
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# -------------------------------------------
# MIDDLEWARE CONFIG
# -------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# -------------------------------------------
# URLS, WSGI & ASGI
# -------------------------------------------
ROOT_URLCONF = "tuchati_config.urls"
WSGI_APPLICATION = "tuchati_config.wsgi.application"
ASGI_APPLICATION = "tuchati_config.asgi.application"


# -------------------------------------------
# DATABASE CONFIGURATION
# Works for both Docker and VPS
# -------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "tuchati"),
        "USER": os.getenv("POSTGRES_USER", "tuchati"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "tuchati"),
       # "HOST": os.getenv("POSTGRES_HOST", "tuchati_db"),  # use db in prod compose
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}


# -------------------------------------------
# CUSTOM USER MODEL
# -------------------------------------------
AUTH_USER_MODEL = "accounts.User"


# -------------------------------------------
# INTERNATIONALIZATION
# -------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# -------------------------------------------
# STATIC & MEDIA FILES
# -------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # where static files are collected
#STATICFILES_DIRS = [BASE_DIR / "backend" / "static"]  # dev static dir
STATICFILES_DIRS = [BASE_DIR / "static"]


MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"  # uploaded files

# Run this in Docker when needed:
# docker compose exec ongea_backend python manage.py collectstatic --noinput


# -------------------------------------------
# CORS & CSRF
# -------------------------------------------
CORS_ALLOW_ALL = bool(int(os.getenv("CORS_ALLOW_ALL", "0")))
CSRF_TRUSTED_ORIGINS = [o for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o]


# -------------------------------------------
# DJANGO REST FRAMEWORK CONFIG
# -------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}


# -------------------------------------------
# JWT TOKEN LIFETIMES
# -------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("ACCESS_LIFETIME", "5"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("REFRESH_LIFETIME", "1440"))),
}


# -------------------------------------------
# CHANNELS / REDIS CONFIG
# -------------------------------------------
REDIS_URL = os.getenv("REDIS_URL", "")
if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }


# -------------------------------------------
# Jazzmin Admin Customization
# -------------------------------------------
JAZZMIN_SETTINGS = {
    "site_title": "TuChati Admin",
    "site_header": "TuChati Administration",
    "site_brand": "TuChati",
    "welcome_sign": "Welcome to TuChati Admin",
    "copyright": "© 2025 Tuunganes Technologies",
    "theme": "cyborg",  # later we will check "lux", "superhero", "flatly"
}

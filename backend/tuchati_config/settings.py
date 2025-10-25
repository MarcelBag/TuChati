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
    "jazzmin",
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
    "django_filters",

    # Local apps
    "apps.accounts",
    # Chat System
    "apps.chat",
    # Admin Center
    "apps.adminpanel",
]

# -------------------------------------------
# TEMPLATE CONFIGURATION
# Enabling Django admin + custom templates but we will move this to React later
# -------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # templates goingw with twofa for email 2FA
        "DIRS": [
            BASE_DIR / "templates",
            BASE_DIR / "apps" / "accounts" / "twofa" / "templates",
        ],
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
       # "HOST": os.getenv("POSTGRES_HOST", "tuchati_db"),
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
# EMAIL CONFIGURATION
# -------------------------------------------
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "25"))
def _bool_env(name: str, default: str = "0") -> bool:
    value = os.getenv(name)
    if value is None:
        value = default
    value = value.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    # fall back to Python truthiness for unexpected values
    return bool(value)

EMAIL_USE_TLS = _bool_env("EMAIL_USE_TLS", "0")
EMAIL_USE_SSL = _bool_env("EMAIL_USE_SSL", "0")
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")

# Prefer provided default-from, otherwise fallback to host user or a generic sender
DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL",
    EMAIL_HOST_USER or "TuChati <no-reply@tuchati.tuunganes.com>",
)

if EMAIL_USE_TLS and EMAIL_USE_SSL:
    # Django will raise if both enabled; normalizing here to avoid config mistakes
    EMAIL_USE_SSL = False

# Brand theming for notifications / emails
APP_BRAND_NAME = os.getenv("APP_BRAND_NAME", "TuChati")
APP_BRAND_URL = os.getenv("APP_BRAND_URL", "https://tuchati.tuunganes.com")
APP_SUPPORT_EMAIL = os.getenv("APP_SUPPORT_EMAIL", EMAIL_HOST_USER or DEFAULT_FROM_EMAIL)
# -------------------------------------------
# STATIC & MEDIA FILES
# -------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # where static files are collected
#STATICFILES_DIRS = [BASE_DIR / "backend" / "static"]  # dev static dir
STATICFILES_DIRS = [BASE_DIR / "static"]


MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"  # uploaded files

# -------------------------------------------
# CORS & CSRF
# -------------------------------------------
CORS_ALLOW_ALL_ORIGINS = bool(int(os.getenv("CORS_ALLOW_ALL_ORIGINS", "0")))

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5183",
    "http://127.0.0.1:5183",
    "https://web.tuchati.tuunganes.com",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5183",
    "http://127.0.0.1:5183",
    "http://localhost:8092",
    "http://127.0.0.1:8092",
    "https://tuchati.tuunganes.com",
    "https://web.tuchati.tuunganes.com",
]
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
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
    ),
}
# -------------------------------------------
# AUTHENTICATION BACKENDS
# -------------------------------------------
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]
# -------------------------------------------
# JWT TOKEN LIFETIMES
# -------------------------------------------
SIMPLE_JWT = {
    #"ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("ACCESS_LIFETIME", "5"))),
    #"REFRESH_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("REFRESH_LIFETIME", "1440"))),
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7), 
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

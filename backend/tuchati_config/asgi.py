# =============================================================
# backend/tuchati_config/asgi.py
# TuChati - ASGI configuration for Channels (WebSockets)
# =============================================================
import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application

# -----------------------------
# Django environment setup
# -----------------------------
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tuchati_config.settings")
django.setup()

# -----------------------------
# Import AFTER setup
# -----------------------------
from apps.chat.middleware import TokenAuthMiddleware  # noqa: E402
from apps.chat.routing import websocket_urlpatterns   # noqa: E402

# -----------------------------
# HTTP + WebSocket Routing
# -----------------------------
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(  # use JWT-based middleware
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})

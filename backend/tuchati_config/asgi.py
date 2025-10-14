# backend/tuchati_config/asgi.py
import os, django
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tuchati_config.settings")
django.setup()

from apps.chat.middleware import TokenAuthMiddleware
from apps.chat.routing import websocket_urlpatterns

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})

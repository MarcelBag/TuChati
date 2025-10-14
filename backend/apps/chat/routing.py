# backend/apps/chat/routing.py
from django.urls import re_path
from .consumers import ChatConsumer

# Accept:
#   /ws/chat/<uuid>/
#   /ws/chat/<uuid>
websocket_urlpatterns = [
    re_path(r"^ws/chat/(?P<room_id>[0-9a-fA-F-]+)/?$", ChatConsumer.as_asgi()),
]

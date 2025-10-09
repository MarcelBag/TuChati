# ============================================================
# backend/apps/chat/urls.py
# TuChati  Chat API Routes
# ============================================================
# Base path:
#   /api/chat/
#
# Endpoints:
#   GET    /api/chat/rooms/                       List user’s rooms
#   POST   /api/chat/rooms/                      Create a new room
#   GET    /api/chat/rooms/<uuid:pk>/            Retrieve specific room
#   PUT    /api/chat/rooms/<uuid:pk>/            Update room
#   DELETE /api/chat/rooms/<uuid:pk>/            Delete room
#   GET    /api/chat/rooms/<uuid:room_id>/messages/   List messages in room
#   POST   /api/chat/rooms/<uuid:room_id>/messages/  Send a message
# ============================================================

from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import ChatRoomViewSet, MessageListCreateViewSet

# Router handles all /rooms/ CRUD routes automatically
router = DefaultRouter()
router.register(r"rooms", ChatRoomViewSet, basename="chatroom")

urlpatterns = [
    path("", include(router.urls)),

    # Nested message endpoints
    path(
        "rooms/<uuid:room_id>/messages/",
        MessageListCreateViewSet.as_view({"get": "list", "post": "create"}),
        name="chat_room_messages",
    ),
]

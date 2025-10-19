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
from .views import ChatRoomViewSet, MessageListCreateViewSet, DirectChatRequestViewSet, GroupInviteViewSet

# Router handles all /rooms/ CRUD routes automatically
router = DefaultRouter()
router.register(r"rooms", ChatRoomViewSet, basename="chatroom")
router.register(r"direct/requests", DirectChatRequestViewSet, basename="direct-request")
router.register(r"group/invites", GroupInviteViewSet, basename="group-invite")

urlpatterns = [
    path("", include(router.urls)),

    # Nested message endpoints
    path(
        "rooms/<uuid:room_id>/messages/",
        MessageListCreateViewSet.as_view({"get": "list", "post": "create"}),
        name="chat_room_messages",
    ),
    path(
        "rooms/<uuid:room_id>/messages/bulk-delete/",
        MessageListCreateViewSet.as_view({"post": "bulk_delete"}),
        name="chat_room_messages_bulk_delete",
    ),
    path(
        "rooms/<uuid:room_id>/messages/<uuid:pk>/delete/",
        MessageListCreateViewSet.as_view({"post": "delete_message"}),
        name="chat_room_message_delete",
    ),
    path(
        "rooms/<uuid:room_id>/messages/<uuid:pk>/pin/",
        MessageListCreateViewSet.as_view({"post": "pin"}),
        name="chat_room_message_pin",
    ),
    path(
        "rooms/<uuid:room_id>/messages/<uuid:pk>/star/",
        MessageListCreateViewSet.as_view({"post": "star"}),
        name="chat_room_message_star",
    ),
    path(
        "rooms/<uuid:room_id>/messages/<uuid:pk>/note/",
        MessageListCreateViewSet.as_view({"post": "note"}),
        name="chat_room_message_note",
    ),
    path(
        "rooms/<uuid:room_id>/messages/<uuid:pk>/info/",
        MessageListCreateViewSet.as_view({"get": "info"}),
        name="chat_room_message_info",
    ),
]

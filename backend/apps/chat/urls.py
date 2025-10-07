# ============================================================
# backend/apps/chat/urls.py
# TuChati  Chat API Routes
# ============================================================
# This module defines REST API endpoints for the chat system.
#
# Base path suggestion
#   /api/chat/
#
# Endpoints:
#   GET    /api/chat/rooms/                    List rooms for the user
#   POST   /api/chat/rooms/                   Create a new room
#   GET    /api/chat/rooms/<uuid:pk>/          Retrieve specific room
#   PUT    /api/chat/rooms/<uuid:pk>/         Update room
#   DELETE /api/chat/rooms/<uuid:pk>/         Delete room
#   GET    /api/chat/rooms/<uuid:room_id>/messages/   List messages in room
#   POST   /api/chat/rooms/<uuid:room_id>/messages/ Send a message
# ============================================================

from django.urls import path
from .views import (
    RoomListCreateView,
    RoomDetailView,
    MessageListCreateView,
)

urlpatterns = [
    # -------------------------------
    # Room endpoints
    # -------------------------------
    path(
        "rooms/",
        RoomListCreateView.as_view(),
        name="chat_rooms",
    ),
    path(
        "rooms/<uuid:pk>/",
        RoomDetailView.as_view(),
        name="chat_room_detail",
    ),

    # -------------------------------
    #  Message endpoints
    # -------------------------------
    path(
        "rooms/<uuid:room_id>/messages/",
        MessageListCreateView.as_view(),
        name="chat_room_messages",
    ),
]

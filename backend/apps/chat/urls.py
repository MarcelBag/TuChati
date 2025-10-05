# backend/apps/chat/urls.py
from django.urls import path
from .views import RoomListCreateView, RoomDetailView, MessageListCreateView

urlpatterns = [
    path("rooms/", RoomListCreateView.as_view(), name="chat_rooms"),
    path("rooms/<uuid:pk>/", RoomDetailView.as_view(), name="chat_room_detail"),
    path("rooms/<uuid:room_id>/messages/", MessageListCreateView.as_view(), name="chat_room_messages"),
]
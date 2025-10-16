# backend/apps/chat/admin.py
from django.contrib import admin
from .models import ChatRoom, Message, DirectChatRequest


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_group", "created_at")
    search_fields = ("id", "name")
    filter_horizontal = ("participants",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "room", "sender", "is_read", "created_at")
    search_fields = ("content", "room__name", "sender__email")
    list_filter = ("is_read", "created_at")


@admin.register(DirectChatRequest)
class DirectChatRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "from_user", "to_user", "status", "created_at", "responded_at")
    list_filter = ("status", "created_at")
    search_fields = ("from_user__username", "to_user__username")

# backend/apps/chat/chat_utils.py
from apps.chat.models import ChatRoom

def get_or_create_direct_room(user1, user2):
    room = ChatRoom.objects.filter(
        is_group=False,
        participants=user1
    ).filter(
        participants=user2
    ).distinct().first()

    if not room:
        room = ChatRoom.objects.create(is_group=False)
        room.participants.add(user1, user2)
    return room

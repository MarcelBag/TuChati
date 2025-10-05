# backend/apps/chat/middleware.py
import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from channels.middleware.base import BaseMiddleware
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
from django.contrib.auth import get_user_model

User = get_user_model()


@database_sync_to_async
def get_user(validated_token):
    """Return the user from the validated JWT token."""
    try:
        user_id = validated_token.get("user_id")
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """
    Custom middleware for JWT authentication over WebSocket.
    The client must connect like:
      ws://localhost:8000/ws/chat/<room_id>/?token=<JWT>
    """

    async def __call__(self, scope, receive, send):
        close_old_connections()

        query_string = scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]

        if token:
            try:
                # Validate and decode token using DRF SimpleJWT logic
                validated_token = UntypedToken(token)
                decoded_data = jwt.decode(
                    token,
                    settings.SECRET_KEY,
                    algorithms=["HS256"]
                )
                scope["user"] = await get_user(decoded_data)
            except (InvalidToken, TokenError, jwt.ExpiredSignatureError, jwt.DecodeError):
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)

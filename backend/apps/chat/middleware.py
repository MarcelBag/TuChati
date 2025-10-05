# ===========================================================
# backend/apps/chat/middleware.py
# Custom TokenAuthMiddleware for JWT-based WebSocket auth
# ===========================================================
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware   # ✅ correct import
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import UntypedToken
from jwt import InvalidTokenError

User = get_user_model()


class TokenAuthMiddleware(BaseMiddleware):
    """
    Custom middleware for authenticating users via JWT token in WebSocket connections.
    Expected usage: ws://.../ws/chat/<room_id>/?token=<JWT>
    """

    async def __call__(self, scope, receive, send):
        query_string = parse_qs(scope["query_string"].decode())
        token = query_string.get("token", [None])[0]

        if token:
            user = await self.get_user(token)
            if user:
                scope["user"] = user

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user(self, token):
        try:
            UntypedToken(token)  # Verify validity
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("user_id")
            return User.objects.get(id=user_id)
        except (InvalidTokenError, User.DoesNotExist, jwt.DecodeError):
            return None

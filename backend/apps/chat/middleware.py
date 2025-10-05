# ===========================================================
# Custom TokenAuthMiddleware for JWT-based WebSocket auth
# ===========================================================
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
#from channels.middleware.base import BaseMiddleware
from channels.middleware import BaseMiddleware

from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken

User = get_user_model()


class TokenAuthMiddleware(BaseMiddleware):
    """
    Custom middleware for authenticating users via JWT token in WebSocket connections.
    Expected usage: ws://.../ws/chat/<room_id>/?token=<JWT access token>
    """

    async def __call__(self, scope, receive, send):
        query_string = parse_qs(scope["query_string"].decode())
        token = query_string.get("token", [None])[0]

        if token:
            user = await self.get_user(token)
            if user:
                # ✅ Properly attach the user
                scope["user"] = user
                print(f"[WS-MW] ✅ Authenticated user: {user.username}")
            else:
                print(f"[WS-MW] ❌ Invalid token or user not found")
        else:
            print("[WS-MW] ⚠️ No token in query string")

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user(self, token):
        try:
            token_obj = AccessToken(token)
            payload = jwt.decode(str(token_obj), settings.SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("user_id")
            user = User.objects.get(id=user_id)
            return user
        except (InvalidToken, User.DoesNotExist, jwt.DecodeError) as e:
            print(f"[WS-MW] Token validation failed: {e}")
            return None

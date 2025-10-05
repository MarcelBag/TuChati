# backend/apps/chat/middleware.py
# ===========================================================
# Custom TokenAuthMiddleware for JWT-based WebSocket auth
# ===========================================================
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken  # ✅ Use AccessToken for access tokens
from rest_framework_simplejwt.exceptions import InvalidToken  # ✅ Correct: Use InvalidToken (not InvalidTokenError)

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
                scope["user"] = user
                # Optional: Log success for debugging
                print(f"[WS-MW] Auth success: user={user.username}")

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user(self, token):
        try:
            # ✅ Use AccessToken: Validates signature, exp, token_type='access'
            token_obj = AccessToken(token)
            user_id = token_obj["user_id"]  # Guaranteed present in access tokens
            user = User.objects.get(id=user_id)
            # Optional: Log for debugging
            print(f"[WS-MW] Decoded user_id={user_id}")
            return user
        except (InvalidToken, User.DoesNotExist):
            # Optional: Log failure
            print(f"[WS-MW] Auth failed: Invalid token or user not found")
            return None
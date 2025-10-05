# ===============================================================
# backend/apps/accounts/serializers_jwt.py
# Custom JWT Serializer for username or email login
# ===============================================================
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from rest_framework import serializers


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Allow login with either username or email.
    """

    username_field = "username"  # fallback

    def validate(self, attrs):
        username_or_email = attrs.get("username")
        password = attrs.get("password")

        # Try to authenticate with username first
        user = authenticate(username=username_or_email, password=password)
        if not user:
            # Try email
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user_obj = User.objects.get(email=username_or_email)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass

        if not user:
            raise serializers.ValidationError("Invalid credentials provided.")

        data = super().validate({"username": user.username, "password": password})
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        }
        return data

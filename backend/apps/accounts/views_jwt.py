# ===============================================================
# backend/apps/accounts/views_jwt.py
# Custom JWT View using our flexible serializer
# ===============================================================
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers_jwt import CustomTokenObtainPairSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

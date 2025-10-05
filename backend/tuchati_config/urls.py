# ============================================================
# backend/tuchati_config/urls.py
# TuChati - Global URL Configuration
# ============================================================
# This file connects all app routes together.
# REST API base prefix: /api/
# ============================================================

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
#from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views_jwt import CustomTokenObtainPairView


urlpatterns = [
    # -------------------------------
    # Admin & Authentication
    # -------------------------------
    path("admin/", admin.site.urls),
    path("api/accounts/", include("apps.accounts.urls")),  # user-related routes

    # -------------------------------
    # JWT Authentication Endpoints
    # -------------------------------
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # -------------------------------
    # Chat system
    # -------------------------------
    path("api/chat/", include("apps.chat.urls")),  # chat endpoints (rooms & messages)
]

# -------------------------------
# Serve media & static files in development
# -------------------------------
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

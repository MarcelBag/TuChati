# backend/apps/accounts/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    MeView,
    AvatarUploadView,
    PasswordChangeView,
    SessionsView,
    LogoutAllView,
    PresenceView,
    UserSearchView,
    UserProfileView,
)
from .twofa import (
    RegisterStartView,
    RegisterVerifyView,
    RegisterCompleteView,
    PasswordResetStartView,
    PasswordResetVerifyView,
    PasswordResetCompleteView,
)
from .views_jwt import CustomTokenObtainPairView

urlpatterns = [
    # Auth
    path("register/", RegisterView.as_view(), name="register"),
    path("register/start/", RegisterStartView.as_view(), name="register-start"),
    path("register/verify/", RegisterVerifyView.as_view(), name="register-verify"),
    path("register/complete/", RegisterCompleteView.as_view(), name="register-complete"),
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Profile
    path("me/", MeView.as_view(), name="me"),
    path("me/presence/", PresenceView.as_view(), name="me-presence"),
    path("avatar/", AvatarUploadView.as_view(), name="avatar-upload"),
    path("password/change/", PasswordChangeView.as_view(), name="password-change"),
    path("password/reset/", PasswordResetStartView.as_view(), name="password-reset"),
    path("password/reset/verify/", PasswordResetVerifyView.as_view(), name="password-reset-verify"),
    path("password/reset/confirm/", PasswordResetCompleteView.as_view(), name="password-reset-confirm"),

    # Sessions
    path("sessions/", SessionsView.as_view(), name="sessions"),
    path("sessions/<uuid:session_id>/", SessionsView.as_view(), name="session-detail"),
    path("logout-all/", LogoutAllView.as_view(), name="logout-all"),
    path("search/", UserSearchView.as_view(), name="user-search"),
    path("users/<str:identifier>/profile/", UserProfileView.as_view(), name="user-profile"),
]

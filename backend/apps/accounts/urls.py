# backend/apps/accounts/urls.py
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, MeView
# import your custom one
from .views_jwt import CustomTokenObtainPairView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
    # use custom
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

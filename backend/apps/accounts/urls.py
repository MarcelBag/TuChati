from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, LoginView, TwoFASetupView, TwoFAEnableView, TwoFAVerifyView, MeView
urlpatterns=[
 path('register/',RegisterView.as_view()),
 path('login/',LoginView.as_view()),
 path('me/',MeView.as_view()),
 path('token/refresh/',TokenRefreshView.as_view()),
 path('2fa/setup/',TwoFASetupView.as_view()),
 path('2fa/enable/',TwoFAEnableView.as_view()),
 path('2fa/verify/',TwoFAVerifyView.as_view()),
]

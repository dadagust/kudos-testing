from django.urls import path

from .views import AuthLoginView, AuthLogoutView, AuthMeView, ping

urlpatterns = [
    path('ping/', ping, name='ping'),
    path('auth/login/', AuthLoginView.as_view(), name='auth-login'),
    path('auth/me/', AuthMeView.as_view(), name='auth-me'),
    path('auth/logout/', AuthLogoutView.as_view(), name='auth-logout'),
]

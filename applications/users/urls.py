from django.urls import path

from .views import AuthLoginView, AuthLogoutView, AuthMeView

urlpatterns = [
    path('login/', AuthLoginView.as_view(), name='auth-login'),
    path('me/', AuthMeView.as_view(), name='auth-me'),
    path('logout/', AuthLogoutView.as_view(), name='auth-logout'),
]

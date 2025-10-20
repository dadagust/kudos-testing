from django.urls import re_path

from .views import AuthLoginView, AuthLogoutView, AuthMeView

urlpatterns = [
    re_path(r'^login/?$', AuthLoginView.as_view(), name='auth-login'),
    re_path(r'^me/?$', AuthMeView.as_view(), name='auth-me'),
    re_path(r'^logout/?$', AuthLogoutView.as_view(), name='auth-logout'),
]

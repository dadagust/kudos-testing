from django.urls import path

from applications.common.url_utils import allow_optional_trailing_slash

from .views import AuthLoginView, AuthLogoutView, AuthMeView, AuthRefreshView

app_name = 'users'

urlpatterns = allow_optional_trailing_slash(
    [
        path(
            'login/',
            AuthLoginView.as_view(),
            name='auth-login',
        ),
        path(
            'me/',
            AuthMeView.as_view(),
            name='auth-me',
        ),
        path(
            'logout/',
            AuthLogoutView.as_view(),
            name='auth-logout',
        ),
        path(
            'refresh/',
            AuthRefreshView.as_view(),
            name='auth-refresh',
        ),
    ]
)

from django.urls import path

from applications.common.url_utils import allow_optional_trailing_slash

from .views import AuditLogListView

urlpatterns = allow_optional_trailing_slash(
    [
        path('', AuditLogListView.as_view(), name='audit-log-list'),
    ]
)

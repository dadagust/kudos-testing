"""URL routing for order API."""

from __future__ import annotations

from django.urls import re_path
from rest_framework.urlpatterns import format_suffix_patterns

from .views import OrderViewSet

app_name = 'orders'

order_list = OrderViewSet.as_view({'get': 'list', 'post': 'create'})
order_detail = OrderViewSet.as_view(
    {
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy',
    }
)

urlpatterns = format_suffix_patterns(
    [
        re_path(r'^order/?$', order_list, name='order-list'),
        re_path(r'^order/(?P<pk>[^/]+)/?$', order_detail, name='order-detail'),
    ]
)

"""URL routing for order API."""

from django.urls import path

from .views import OrderCalculationView, OrderViewSet

app_name = 'orders'

urlpatterns = [
    path(
        'order/',
        OrderViewSet.as_view(
            {
                'get': 'list',
                'post': 'create',
            }
        ),
        name='order-list',
    ),
    path(
        'order/calculate-total/',
        OrderCalculationView.as_view(),
        name='order-calculate-total',
    ),
    path(
        'order/<uuid:pk>/',
        OrderViewSet.as_view(
            {
                'get': 'retrieve',
                'put': 'update',
                'patch': 'partial_update',
                'delete': 'destroy',
            }
        ),
        name='order-detail',
    ),
]

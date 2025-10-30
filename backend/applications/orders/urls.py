"""URL routing for order API."""

from django.urls import path

from .views import OrderCalculationView, OrderViewSet

app_name = 'orders'

order_list = OrderViewSet.as_view(
    {
        'get': 'list',
        'post': 'create',
    }
)
order_detail = OrderViewSet.as_view(
    {
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy',
    }
)
order_calculate = OrderCalculationView.as_view()

urlpatterns = [
    path(
        'order/',
        order_list,
        name='order-list',
    ),
    path(
        'order/calculate-total/',
        order_calculate,
        name='order-calculate-total',
    ),
    path(
        'order/<uuid:pk>/',
        order_detail,
        name='order-detail',
    ),
]

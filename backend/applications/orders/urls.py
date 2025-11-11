"""URL routing for order API."""

from django.urls import path

from applications.common.url_utils import allow_optional_trailing_slash

from .views import OrderCalculationView, OrderViewSet, OrdersWithCoordsView, YandexSuggestView

app_name = 'orders'

urlpatterns = allow_optional_trailing_slash(
    [
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
            'order/<int:pk>/',
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
        path(
            'order/<int:pk>/payment-status/',
            OrderViewSet.as_view(
                {
                    'patch': 'update_payment_status',
                }
            ),
            name='order-update-payment-status',
        ),
        path(
            'order/<int:pk>/logistics-state/',
            OrderViewSet.as_view(
                {
                    'patch': 'update_logistics_state',
                }
            ),
            name='order-update-logistics-state',
        ),
        path(
            'order/<int:pk>/receive/',
            OrderViewSet.as_view(
                {
                    'post': 'receive',
                }
            ),
            name='order-receive',
        ),
        path(
            'order/<int:pk>/validate-address/',
            OrderViewSet.as_view({'post': 'validate_address'}),
            name='order-validate-address',
        ),
        path(
            'order/<int:pk>/driver/',
            OrderViewSet.as_view({'post': 'assign_driver'}),
            name='order-assign-driver',
        ),
        path(
            'orders/',
            OrderViewSet.as_view(
                {
                    'get': 'list',
                    'post': 'create',
                }
            ),
            name='orders-list',
        ),
        path(
            'orders/<int:pk>/',
            OrderViewSet.as_view(
                {
                    'get': 'retrieve',
                    'put': 'update',
                    'patch': 'partial_update',
                    'delete': 'destroy',
                }
            ),
            name='orders-detail',
        ),
        path(
            'orders/<int:pk>/payment-status/',
            OrderViewSet.as_view(
                {
                    'patch': 'update_payment_status',
                }
            ),
            name='orders-update-payment-status',
        ),
        path(
            'orders/<int:pk>/logistics-state/',
            OrderViewSet.as_view(
                {
                    'patch': 'update_logistics_state',
                }
            ),
            name='orders-update-logistics-state',
        ),
        path(
            'orders/<int:pk>/receive/',
            OrderViewSet.as_view(
                {
                    'post': 'receive',
                }
            ),
            name='orders-receive',
        ),
        path(
            'orders/<int:pk>/validate-address/',
            OrderViewSet.as_view({'post': 'validate_address'}),
            name='orders-validate-address',
        ),
        path(
            'orders/<int:pk>/driver/',
            OrderViewSet.as_view({'post': 'assign_driver'}),
            name='orders-assign-driver',
        ),
        path(
            'orders-with-coords/',
            OrdersWithCoordsView.as_view(),
            name='orders-with-coords',
        ),
        path('ymaps/suggest/', YandexSuggestView.as_view(), name='ymaps-suggest'),
    ]
)

"""URL routing for customer API."""

from django.urls import path

from .views import CustomerContactViewSet, CustomerViewSet

app_name = 'customers'


urlpatterns = [
    path(
        'customer/',
        CustomerViewSet.as_view(
            {
                'get': 'list',
                'post': 'create',
            }
        ),
        name='customer-list',
    ),
    path(
        'customer/export/',
        CustomerViewSet.as_view(
            {
                'get': 'export',
            }
        ),
        name='customer-export',
    ),
    path(
        'customer/<uuid:pk>/',
        CustomerViewSet.as_view(
            {
                'get': 'retrieve',
                'put': 'update',
                'patch': 'partial_update',
                'delete': 'destroy',
            }
        ),
        name='customer-detail',
    ),
    path(
        'customer/<uuid:customer_id>/contact/',
        CustomerContactViewSet.as_view(
            {
                'get': 'list',
                'post': 'create',
            }
        ),
        name='customer-contact',
    ),
]

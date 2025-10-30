"""URL routing for customer API."""

from django.urls import path

from .views import CustomerContactViewSet, CustomerViewSet

app_name = 'customers'

customer_list = CustomerViewSet.as_view(
    {
        'get': 'list',
        'post': 'create',
    }
)
customer_detail = CustomerViewSet.as_view(
    {
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy',
    }
)
customer_export = CustomerViewSet.as_view(
    {
        'get': 'export',
    }
)
contact_list = CustomerContactViewSet.as_view(
    {
        'get': 'list',
        'post': 'create',
    }
)

urlpatterns = [
    path(
        'customer/',
        customer_list,
        name='customer-list',
    ),
    path(
        'customer/export/',
        customer_export,
        name='customer-export',
    ),
    path(
        'customer/<uuid:pk>/',
        customer_detail,
        name='customer-detail',
    ),
    path(
        'customer/<uuid:customer_id>/contact/',
        contact_list,
        name='customer-contact',
    ),
]

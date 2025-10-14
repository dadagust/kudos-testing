"""URL routing for customer API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CustomerContactViewSet, CustomerViewSet

app_name = 'customers'

router = DefaultRouter()
router.register('customer', CustomerViewSet, basename='customer')

contact_list = CustomerContactViewSet.as_view({'get': 'list', 'post': 'create'})

urlpatterns = [
    path('', include(router.urls)),
    path('customer/<uuid:customer_id>/contact/', contact_list, name='customer-contact'),
]

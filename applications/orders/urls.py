"""URL routing for order API."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OrderViewSet

app_name = 'orders'

router = DefaultRouter()
router.register('orders', OrderViewSet, basename='order')

urlpatterns = [
    path('', include(router.urls)),
]

__all__ = ['app_name', 'urlpatterns']

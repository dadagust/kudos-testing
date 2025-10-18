"""URL routing for order API."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OrderViewSet

app_name = 'orders'

router = DefaultRouter()
router.register('order', OrderViewSet, basename='order')

urlpatterns = [
    path('', include(router.urls)),
]

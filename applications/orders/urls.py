"""URL configuration for order API."""

from __future__ import annotations

from rest_framework.routers import DefaultRouter

from .views import OrderViewSet

router = DefaultRouter()
router.register('order', OrderViewSet, basename='order')

urlpatterns = router.urls

"""Routing for product endpoints."""

from rest_framework.routers import DefaultRouter

from .views import ProductViewSet

app_name = 'products'


router = DefaultRouter(trailing_slash='/?')
router.register('products', ProductViewSet, basename='product')

urlpatterns = router.urls

__all__ = ['urlpatterns']

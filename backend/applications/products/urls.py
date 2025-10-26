"""Routing for product endpoints."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryTreeView, ColorsListView, EnumsAggregateView, ProductViewSet

app_name = 'products'

router = DefaultRouter()
router.register('products', ProductViewSet, basename='product')

urlpatterns = [
    path('', include(router.urls)),
    path('products/categories', CategoryTreeView.as_view(), name='product-categories'),
    path('products/colors', ColorsListView.as_view(), name='product-colors'),
    path('products/enums', EnumsAggregateView.as_view(), name='product-enums'),
]

__all__ = ['urlpatterns']

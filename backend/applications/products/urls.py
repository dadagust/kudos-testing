"""Routing for product endpoints."""

from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from .views import CategoryTreeView, ColorsListView, EnumsAggregateView, ProductViewSet

app_name = 'products'


class OptionalSlashRouter(DefaultRouter):
    """Default router variant that accepts URLs with or without the trailing slash."""

    def __init__(self) -> None:
        super().__init__(trailing_slash=False)
        self.trailing_slash = '/?'


router = OptionalSlashRouter()
router.register('products', ProductViewSet, basename='product')


lookup_kwarg = ProductViewSet.lookup_url_kwarg or ProductViewSet.lookup_field
lookup_regex = ProductViewSet.lookup_value_regex

urlpatterns = [
    re_path(
        r'^products/categories/?$',
        CategoryTreeView.as_view(),
        name='product-categories',
    ),
    re_path(
        r'^products/colors/?$',
        ColorsListView.as_view(),
        name='product-colors',
    ),
    re_path(
        r'^products/enums/?$',
        EnumsAggregateView.as_view(),
        name='product-enums',
    ),
    re_path(
        rf'^products/(?P<{lookup_kwarg}>{lookup_regex})/images/reorder/?$',
        ProductViewSet.as_view({'patch': 'reorder_images'}),
        name='product-reorder-images',
    ),
    path('', include(router.urls)),
]

__all__ = ['urlpatterns']

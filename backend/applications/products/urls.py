"""Routing for product endpoints."""

from django.urls import path

from applications.common.url_utils import allow_optional_trailing_slash

from .views import CategoryTreeView, ColorsListView, EnumsAggregateView, ProductViewSet

app_name = 'products'


urlpatterns = allow_optional_trailing_slash(
    [
        path(
            'products/',
            ProductViewSet.as_view(
                {
                    'get': 'list',
                    'post': 'create',
                }
            ),
            name='product-list',
        ),
        path(
            'products/<uuid:id>/',
            ProductViewSet.as_view(
                {
                    'get': 'retrieve',
                    'put': 'update',
                    'patch': 'partial_update',
                    'delete': 'destroy',
                }
            ),
            name='product-detail',
        ),
        path(
            'products/<uuid:id>/images/',
            ProductViewSet.as_view(
                {
                    'post': 'upload_images',
                }
            ),
            name='product-images',
        ),
        path(
            'products/<uuid:id>/images/reorder/',
            ProductViewSet.as_view(
                {
                    'patch': 'reorder_images',
                }
            ),
            name='product-images-reorder',
        ),
        path(
            'products/<uuid:id>/images/<uuid:image_id>/',
            ProductViewSet.as_view(
                {
                    'delete': 'delete_image',
                }
            ),
            name='product-image-delete',
        ),
        path(
            'products/categories/',
            CategoryTreeView.as_view(),
            name='product-categories',
        ),
        path(
            'products/colors/',
            ColorsListView.as_view(),
            name='product-colors',
        ),
        path(
            'products/enums/',
            EnumsAggregateView.as_view(),
            name='product-enums',
        ),
    ]
)

__all__ = ['urlpatterns']

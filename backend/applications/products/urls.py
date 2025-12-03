"""Routing for product endpoints."""

from django.urls import path

from applications.common.url_utils import allow_optional_trailing_slash

from .views import (
    CategoryTreeView,
    CategoryProductsView,
    CategoryItemsBySlugView,
    NewProductsView,
    ColorsListView,
    EnumsAggregateView,
    ProductGroupViewSet,
    ProductTransactionViewSet,
    ProductViewSet,
)

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
            'products/<uuid:id>/transactions/',
            ProductTransactionViewSet.as_view({'get': 'list', 'post': 'create'}),
            name='product-transactions',
        ),
        path(
            'products/categories/',
            CategoryTreeView.as_view(),
            name='product-categories',
        ),
        path(
            'products/category-items/',
            CategoryProductsView.as_view(),
            name='product-category-items',
        ),
        path(
            'products/categories/<slug:slug>/items/',
            CategoryItemsBySlugView.as_view(),
            name='product-category-items-by-slug',
        ),
        path(
            'products/new-items/',
            NewProductsView.as_view(),
            name='product-new-items',
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
        path(
            'products/groups/',
            ProductGroupViewSet.as_view(
                {
                    'get': 'list',
                    'post': 'create',
                }
            ),
            name='product-groups-list',
        ),
        path(
            'products/groups/<uuid:id>/',
            ProductGroupViewSet.as_view(
                {
                    'get': 'retrieve',
                    'patch': 'partial_update',
                    'delete': 'destroy',
                }
            ),
            name='product-groups-detail',
        ),
    ]
)

__all__ = ['urlpatterns']

"""Routing for product endpoints."""

from django.urls import path

from .views import CategoryTreeView, ColorsListView, EnumsAggregateView, ProductViewSet

app_name = 'products'

product_list = ProductViewSet.as_view(
    {
        'get': 'list',
        'post': 'create',
    }
)
product_detail = ProductViewSet.as_view(
    {
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy',
    }
)
product_images = ProductViewSet.as_view(
    {
        'post': 'upload_images',
    }
)
product_images_reorder = ProductViewSet.as_view(
    {
        'patch': 'reorder_images',
    }
)
product_image_delete = ProductViewSet.as_view(
    {
        'delete': 'delete_image',
    }
)

urlpatterns = [
    path(
        'products/',
        product_list,
        name='product-list',
    ),
    path(
        'products/<uuid:id>/',
        product_detail,
        name='product-detail',
    ),
    path(
        'products/<uuid:id>/images/',
        product_images,
        name='product-images',
    ),
    path(
        'products/<uuid:id>/images/reorder/',
        product_images_reorder,
        name='product-images-reorder',
    ),
    path(
        'products/<uuid:id>/images/<uuid:image_id>/',
        product_image_delete,
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

__all__ = ['urlpatterns']

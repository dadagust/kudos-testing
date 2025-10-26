"""Public API views exposing product catalog data."""

from __future__ import annotations

from collections.abc import Iterable

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from applications.products.models import Product


def _serialize_product(product: Product) -> dict[str, object]:
    return {
        'id': str(product.id),
        'name': product.name,
        'base_price': float(product.price_rub),
        'color': product.color,
    }


def _iter_products() -> Iterable[dict[str, object]]:
    for product in Product.objects.order_by('-created')[:100]:
        yield _serialize_product(product)


@api_view(['GET'])
@permission_classes([AllowAny])
def product_list(request):
    """Return the catalog of available products."""

    return Response({'data': list(_iter_products())})


@api_view(['GET'])
@permission_classes([AllowAny])
def product_detail(request, product_id: str):
    """Return the details for a single product."""

    product = Product.objects.filter(pk=product_id).first()
    if not product:
        return Response({'detail': 'Product not found'}, status=404)
    return Response({'data': _serialize_product(product)})

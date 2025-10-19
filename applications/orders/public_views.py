"""Public API views exposing product catalog data."""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from django.http import Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import ORDER_PRODUCT_PRICES, OrderProduct


def _serialize_product(product_id: str) -> dict[str, object]:
    try:
        label = OrderProduct(product_id).label
    except ValueError as exc:
        raise Http404('Product not found') from exc
    price: Decimal = ORDER_PRODUCT_PRICES.get(product_id, Decimal('0.00'))
    return {
        'id': product_id,
        'name': label,
        'base_price': float(price),
    }


def _iter_products() -> Iterable[dict[str, object]]:
    for product_id, _ in OrderProduct.choices:
        yield _serialize_product(product_id)


@api_view(['GET'])
@permission_classes([AllowAny])
def product_list(request):
    """Return the catalog of available products."""

    return Response({'data': list(_iter_products())})


@api_view(['GET'])
@permission_classes([AllowAny])
def product_detail(request, product_id: str):
    """Return the details for a single product."""

    return Response({'data': _serialize_product(product_id)})

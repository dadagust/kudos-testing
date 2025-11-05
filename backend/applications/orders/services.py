"""Service helpers for working with order inventory adjustments."""

from __future__ import annotations

from rest_framework import serializers

from applications.products.models import Product

from .models import Order

ProductTotals = dict[str, int]


def collect_order_item_totals(order: Order) -> ProductTotals:
    """Aggregate quantities per product for the given order."""

    totals: ProductTotals = {}
    for item in order.items.select_related('product'):
        if not item.product_id:
            continue
        product_id = str(item.product_id)
        totals[product_id] = totals.get(product_id, 0) + item.quantity
    return totals


def adjust_available_stock(product_totals: ProductTotals, *, increment: bool) -> None:
    """Apply quantity adjustments to product availability.

    When ``increment`` is ``True`` the quantities are returned to stock, when
    ``False`` they are reserved (removed from available stock).
    """

    if not product_totals:
        return

    product_ids = list(product_totals.keys())
    products = {
        str(product.pk): product
        for product in Product.objects.select_for_update().filter(pk__in=product_ids)
    }

    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise serializers.ValidationError({'items': f'Товар {missing[0]} не найден'})

    updated: list[Product] = []
    for product_id, quantity in product_totals.items():
        product = products[product_id]
        if increment:
            product.available_stock_qty += quantity
        else:
            if product.available_stock_qty < quantity:
                raise serializers.ValidationError(
                    {
                        'items': (
                            'Недостаточно товара '
                            f'"{product.name}" на складе. '
                            f'Доступно: {product.available_stock_qty}, требуется: {quantity}.'
                        )
                    }
                )
            product.available_stock_qty -= quantity
        updated.append(product)

    if updated:
        Product.objects.bulk_update(updated, ['available_stock_qty'])

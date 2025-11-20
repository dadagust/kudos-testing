from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from rest_framework import serializers

from applications.orders.models import LogisticsState, Order, OrderStatus
from applications.products.models import OrderStockTransactionType, Product, StockTransaction

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


def validate_stock_availability(product_totals: ProductTotals) -> None:
    """Ensure that requested quantities are available for reservation."""

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

    for product_id, quantity in product_totals.items():
        product = products[product_id]
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


def reset_order_transactions(order: Order) -> None:
    """Remove all stock transactions associated with the order."""

    StockTransaction.objects.filter(order=order).delete()


def ensure_order_stock_transactions(
    order: Order,
    *,
    return_quantities: dict[UUID, int] | None = None,
) -> None:
    """Synchronise stock transactions for the order with its current state."""

    product_totals, products = _collect_item_totals_with_products(order)

    if order.status == OrderStatus.DECLINED or not product_totals:
        reset_order_transactions(order)
        return

    _sync_transaction_group(
        order,
        OrderStockTransactionType.RESERVATION,
        product_totals.items(),
        quantity_sign=-1,
        affects_stock=False,
        affects_available=True,
    )

    should_issue = order.logistics_state == LogisticsState.SHIPPED or order.status in {
        OrderStatus.IN_WORK,
        OrderStatus.ARCHIVED,
    }
    if should_issue:
        _sync_transaction_group(
            order,
            OrderStockTransactionType.ISSUE,
            product_totals.items(),
            quantity_sign=-1,
            affects_stock=True,
            affects_available=False,
        )
    else:
        _delete_transaction_group(order, OrderStockTransactionType.ISSUE)

    return_sources: dict[UUID, int] | None = None
    if order.status == OrderStatus.ARCHIVED:
        if return_quantities is None and not order.warehouse_received_at:
            raise ValueError('Return quantities must be provided for archived orders.')
        source = return_quantities or product_totals
        return_sources = {product_id: source.get(product_id, 0) for product_id in product_totals.keys()}
    elif order.warehouse_received_at:
        return_sources = product_totals

    if return_sources:
        _sync_transaction_group(
            order,
            OrderStockTransactionType.RETURN,
            return_sources.items(),
            quantity_sign=1,
            affects_stock=True,
            affects_available=True,
        )
    else:
        _delete_transaction_group(order, OrderStockTransactionType.RETURN)

    _cleanup_orphan_transactions(order, products)


def _collect_item_totals_with_products(
    order: Order,
) -> tuple[dict[UUID, int], dict[UUID, Product]]:
    totals: dict[UUID, int] = {}
    products: dict[UUID, Product] = {}
    for item in order.items.select_related('product'):
        if not item.product_id or not item.product:
            continue
        totals[item.product_id] = totals.get(item.product_id, 0) + item.quantity
        products[item.product_id] = item.product
    return totals, products


def _sync_transaction_group(
    order: Order,
    transaction_type: OrderStockTransactionType,
    quantities: Iterable[tuple[UUID, int]],
    *,
    quantity_sign: int,
    affects_stock: bool,
    affects_available: bool,
) -> None:
    existing = {
        tx.product_id: tx
        for tx in StockTransaction.objects.filter(
            order=order, order_transaction_type=transaction_type
        )
    }

    for product_id, quantity in quantities:
        transaction = existing.pop(product_id, None)
        desired_delta = quantity_sign * quantity
        if quantity <= 0:
            if transaction is not None:
                transaction.delete()
            continue

        if transaction is None:
            StockTransaction.objects.create(
                order=order,
                order_transaction_type=transaction_type,
                product_id=product_id,
                quantity_delta=desired_delta,
                affects_stock=affects_stock,
                affects_available=affects_available,
                is_applied=True,
            )
            continue

        updates: list[str] = []
        if transaction.quantity_delta != desired_delta:
            transaction.quantity_delta = desired_delta
            updates.append('quantity_delta')
        if transaction.affects_stock != affects_stock:
            transaction.affects_stock = affects_stock
            updates.append('affects_stock')
        if transaction.affects_available != affects_available:
            transaction.affects_available = affects_available
            updates.append('affects_available')
        if not transaction.is_applied:
            transaction.is_applied = True
            updates.append('is_applied')
        if updates:
            transaction.save(update_fields=updates)

    for transaction in existing.values():
        transaction.delete()


def _delete_transaction_group(order: Order, transaction_type: OrderStockTransactionType) -> None:
    StockTransaction.objects.filter(order=order, order_transaction_type=transaction_type).delete()


def _cleanup_orphan_transactions(order: Order, products: dict[UUID, Product]) -> None:
    """Remove order transactions that reference products no longer in the order."""

    valid_product_ids = set(products.keys())
    if not valid_product_ids:
        return

    StockTransaction.objects.filter(order=order).exclude(product_id__in=valid_product_ids).delete()

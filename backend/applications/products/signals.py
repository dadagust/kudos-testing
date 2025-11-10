"""Signal handlers for the products app."""

from __future__ import annotations

from typing import Any

from django.db.models import F, Value
from django.db.models.functions import Greatest
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Product, StockTransaction


def _calculate_contribution(
    quantity_delta: int,
    affects_available: bool,
    affects_stock: bool,
    is_applied: bool,
) -> tuple[int, int]:
    if not is_applied:
        return 0, 0
    stock_change = quantity_delta if affects_stock else 0
    available_change = quantity_delta if affects_available else 0
    return stock_change, available_change


def _apply_stock_delta(product_id, stock_delta: int, available_delta: int) -> None:
    if not (stock_delta or available_delta):
        return

    update_kwargs: dict[str, Any] = {}
    if stock_delta:
        update_kwargs['stock_qty'] = Greatest(Value(0), F('stock_qty') + stock_delta)
    if available_delta:
        update_kwargs['available_stock_qty'] = Greatest(
            Value(0), F('available_stock_qty') + available_delta
        )

    if update_kwargs:
        Product.objects.filter(pk=product_id).update(**update_kwargs)


@receiver(pre_save, sender=StockTransaction)
def store_previous_transaction_state(sender, instance: StockTransaction, **_) -> None:
    previous_stock_change = 0
    previous_available_change = 0
    previous_product_id = None

    if instance.pk:
        try:
            previous = sender.objects.get(pk=instance.pk)
        except sender.DoesNotExist:  # pragma: no cover - race condition safeguard
            previous = None
        if previous is not None:
            previous_product_id = previous.product_id
            previous_stock_change, previous_available_change = _calculate_contribution(
                previous.quantity_delta,
                previous.affects_available,
                getattr(previous, 'affects_stock', True),
                previous.is_applied,
            )

    instance._previous_stock_change = previous_stock_change  # type: ignore[attr-defined]
    instance._previous_available_change = previous_available_change  # type: ignore[attr-defined]
    instance._previous_product_id = previous_product_id  # type: ignore[attr-defined]


@receiver(post_save, sender=StockTransaction)
def apply_transaction(sender, instance: StockTransaction, **_) -> None:
    previous_stock_change = getattr(instance, '_previous_stock_change', 0)
    previous_available_change = getattr(instance, '_previous_available_change', 0)
    previous_product_id = getattr(instance, '_previous_product_id', None)

    new_stock_change, new_available_change = _calculate_contribution(
        instance.quantity_delta,
        instance.affects_available,
        getattr(instance, 'affects_stock', True),
        instance.is_applied,
    )

    if previous_product_id and previous_product_id != instance.product_id:
        _apply_stock_delta(
            previous_product_id,
            -previous_stock_change,
            -previous_available_change,
        )
        _apply_stock_delta(instance.product_id, new_stock_change, new_available_change)
        return

    stock_delta = new_stock_change - previous_stock_change
    available_delta = new_available_change - previous_available_change
    _apply_stock_delta(instance.product_id, stock_delta, available_delta)


@receiver(post_delete, sender=StockTransaction)
def revert_transaction(sender, instance: StockTransaction, **_) -> None:
    stock_change, available_change = _calculate_contribution(
        instance.quantity_delta,
        instance.affects_available,
        getattr(instance, 'affects_stock', True),
        instance.is_applied,
    )
    _apply_stock_delta(instance.product_id, -stock_change, -available_change)

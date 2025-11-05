"""Signal handlers for order inventory synchronisation."""

from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Order
from .services import ensure_order_stock_transactions


@receiver(pre_save, sender=Order)
def store_previous_status(sender, instance: Order, **_) -> None:
    previous_status = None
    if instance.pk:
        try:
            previous_status = sender.objects.only('status').get(pk=instance.pk).status
        except sender.DoesNotExist:  # pragma: no cover - race condition safeguard
            previous_status = None
    instance._previous_status = previous_status  # type: ignore[attr-defined]


@receiver(post_save, sender=Order)
def handle_status_change(sender, instance: Order, created: bool, **_) -> None:
    previous_status = getattr(instance, '_previous_status', None)
    current_status = instance.status
    return_quantities = getattr(instance, '_return_quantities', None)

    if not created and previous_status == current_status and return_quantities is None:
        return

    def _sync() -> None:
        order = sender.objects.prefetch_related('items__product').get(pk=instance.pk)
        ensure_order_stock_transactions(order, return_quantities=return_quantities)

    transaction.on_commit(_sync)

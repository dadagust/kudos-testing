"""Delivery pricing calculations for orders."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from applications.products.models import Product, TransportRestriction

from .yandex_maps import YandexMapsError, calculate_route_distance_km

if TYPE_CHECKING:  # pragma: no cover - type check only
    from applications.orders.models import Order


class DeliveryPricingError(RuntimeError):
    """Raised when delivery pricing cannot be calculated."""


@dataclass(frozen=True)
class DeliveryPricingResult:
    """Detailed result of delivery pricing calculation."""

    transport: TransportRestriction
    transport_count: int
    distance_km: Decimal
    delivery_cost_per_transport: Decimal
    total_delivery_cost: Decimal


def _collect_totals_from_order(order: Order) -> tuple[dict[str, int], dict[str, Product]]:
    totals: dict[str, int] = {}
    products: dict[str, Product] = {}
    queryset = order.items.select_related('product__delivery_transport_restriction')
    for item in queryset:
        product = item.product
        if not product or not product.pk:
            continue
        product_id = str(product.pk)
        totals[product_id] = totals.get(product_id, 0) + item.quantity
        products.setdefault(product_id, product)
    return totals, products


def _select_transport(products: dict[str, Product]) -> TransportRestriction:
    best: TransportRestriction | None = None
    for product in products.values():
        restriction = product.delivery_transport_restriction
        if restriction is None:
            raise DeliveryPricingError(
                f'Для товара "{product.name}" не задано ограничение по транспорту.'
            )
        if best is None:
            best = restriction
            continue
        current_capacity = restriction.capacity_volume_cm3 or 0
        best_capacity = best.capacity_volume_cm3 or 0
        if current_capacity > best_capacity:
            best = restriction
    if best is None:
        raise DeliveryPricingError('Не удалось определить подходящий транспорт для заказа.')
    return best


def _calculate_total_volume_cm3(
    product_totals: dict[str, int], products: dict[str, Product]
) -> int:
    total_volume = 0
    for product_id, quantity in product_totals.items():
        if quantity <= 0:
            continue
        product = products.get(product_id)
        if product is None:
            continue
        volume = product.delivery_volume_cm3 or product.calculate_volume()
        if volume in (None, 0):
            raise DeliveryPricingError(
                f'Для товара "{product.name}" не указан объём для расчёта доставки.'
            )
        total_volume += int(volume) * int(quantity)
    return total_volume


def _get_warehouse_address() -> str:
    from applications.orders.models import DeliverySettings

    settings = DeliverySettings.objects.first()
    address = (settings.warehouse_address if settings else '').strip()
    if not address:
        raise DeliveryPricingError('Не указан адрес склада для расчёта доставки.')
    return address


def calculate_delivery_pricing(
    *,
    delivery_type: str,
    delivery_address: str,
    product_totals: dict[str, int],
    products: dict[str, Product],
) -> DeliveryPricingResult | None:
    """Calculate delivery cost for a payload of products."""

    if delivery_type != 'delivery':
        return None
    destination = (delivery_address or '').strip()
    if not destination:
        raise DeliveryPricingError('Для доставки необходимо указать адрес клиента.')
    if not product_totals:
        return None

    transport = _select_transport(products)
    if not transport.capacity_volume_cm3 or transport.capacity_volume_cm3 <= 0:
        raise DeliveryPricingError(f'У транспорта "{transport.label}" не задан вмещаемый объём.')
    if transport.cost_per_km_rub is None:
        raise DeliveryPricingError(
            f'Не указана стоимость за километр для транспорта "{transport.label}".'
        )
    if transport.cost_per_transport_rub is None:
        raise DeliveryPricingError(
            f'Не указана стоимость за транспорт для транспорта "{transport.label}".'
        )

    total_volume = _calculate_total_volume_cm3(product_totals, products)
    if total_volume <= 0:
        return None

    cost_per_km = Decimal(transport.cost_per_km_rub)
    cost_per_transport = Decimal(transport.cost_per_transport_rub)

    try:
        distance_km = calculate_route_distance_km(_get_warehouse_address(), destination)
    except YandexMapsError as exc:  # pragma: no cover - network errors are handled by caller
        raise DeliveryPricingError(str(exc)) from exc

    transport_capacity = int(transport.capacity_volume_cm3)
    transport_count = max(1, (total_volume + transport_capacity - 1) // transport_capacity)
    per_transport_cost = cost_per_transport + (cost_per_km * distance_km)
    per_transport_cost = per_transport_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    total_cost = (per_transport_cost * transport_count).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    return DeliveryPricingResult(
        transport=transport,
        transport_count=transport_count,
        distance_km=distance_km.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        delivery_cost_per_transport=per_transport_cost,
        total_delivery_cost=total_cost,
    )


def calculate_delivery_pricing_for_order(order: Order) -> DeliveryPricingResult | None:
    """Shortcut for calculating delivery pricing using an order instance."""

    product_totals, products = _collect_totals_from_order(order)
    return calculate_delivery_pricing(
        delivery_type=getattr(order, 'delivery_type', ''),
        delivery_address=order.delivery_address,
        product_totals=product_totals,
        products=products,
    )

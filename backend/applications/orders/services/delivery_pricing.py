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
    total_volume_cm3: int
    total_capacity_cm3: int
    allocations: tuple['TransportAllocation', ...]


@dataclass(frozen=True)
class TransportAllocation:
    """Information about a particular transport type used for delivery."""

    transport: TransportRestriction
    transport_count: int
    capacity_volume_cm3: int
    required_volume_cm3: int
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


def _select_transports(products: dict[str, Product]) -> list[TransportRestriction]:
    transports: dict[str, TransportRestriction] = {}
    for product in products.values():
        restriction = product.delivery_transport_restriction
        if restriction is None:
            raise DeliveryPricingError(
                f'Для товара "{product.name}" не задано ограничение по транспорту.'
            )
        if not restriction.capacity_volume_cm3 or restriction.capacity_volume_cm3 <= 0:
            raise DeliveryPricingError(
                f'У транспорта "{restriction.label}" не задан вмещаемый объём.'
            )
        transports[str(restriction.pk)] = restriction
    if not transports:
        raise DeliveryPricingError('Не удалось определить подходящий транспорт для заказа.')
    return sorted(
        transports.values(), key=lambda item: int(item.capacity_volume_cm3 or 0), reverse=True
    )


def _calculate_total_volume_cm3(
    product_totals: dict[str, int],
    products: dict[str, Product],
) -> tuple[int, dict[str, int]]:
    total_volume = 0
    volume_by_transport: dict[str, int] = {}
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
        restriction = product.delivery_transport_restriction
        if restriction is None:
            raise DeliveryPricingError(
                f'Для товара "{product.name}" не задано ограничение по транспорту.'
            )
        item_volume = int(volume) * int(quantity)
        total_volume += item_volume
        transport_id = str(restriction.pk)
        volume_by_transport[transport_id] = volume_by_transport.get(transport_id, 0) + item_volume
    return total_volume, volume_by_transport


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

    transports = _select_transports(products)
    total_volume, volume_by_transport = _calculate_total_volume_cm3(product_totals, products)
    if total_volume <= 0:
        return None

    try:
        distance_km = calculate_route_distance_km(_get_warehouse_address(), destination)
    except YandexMapsError as exc:  # pragma: no cover - network errors are handled by caller
        raise DeliveryPricingError(str(exc)) from exc

    remaining_volume = {key: value for key, value in volume_by_transport.items()}
    allocations: list[TransportAllocation] = []
    total_capacity_cm3 = 0
    for index, transport in enumerate(transports):
        transport_capacity = int(transport.capacity_volume_cm3 or 0)
        if transport_capacity <= 0:
            continue
        if transport.cost_per_km_rub is None:
            raise DeliveryPricingError(
                f'Не указана стоимость за километр для транспорта "{transport.label}".'
            )
        if transport.cost_per_transport_rub is None:
            raise DeliveryPricingError(
                f'Не указана стоимость за транспорт для транспорта "{transport.label}".'
            )
        cost_per_km = Decimal(transport.cost_per_km_rub)
        cost_per_transport = Decimal(transport.cost_per_transport_rub)
        transport_key = str(transport.pk)
        required_volume = remaining_volume.get(transport_key, 0)
        if required_volume <= 0:
            continue
        transport_count = max(1, (required_volume + transport_capacity - 1) // transport_capacity)
        spare_capacity = transport_count * transport_capacity - required_volume
        if spare_capacity > 0:
            for smaller in transports[index + 1 :]:
                smaller_key = str(smaller.pk)
                smaller_volume = remaining_volume.get(smaller_key, 0)
                if smaller_volume <= 0:
                    continue
                take = min(spare_capacity, smaller_volume)
                remaining_volume[smaller_key] = smaller_volume - take
                spare_capacity -= take
                if spare_capacity <= 0:
                    break
        remaining_volume[transport_key] = 0
        per_transport_cost = cost_per_transport + (cost_per_km * distance_km)
        per_transport_cost = per_transport_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_cost = (per_transport_cost * transport_count).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        allocation_capacity_cm3 = transport_capacity * transport_count
        total_capacity_cm3 += allocation_capacity_cm3
        allocations.append(
            TransportAllocation(
                transport=transport,
                transport_count=transport_count,
                capacity_volume_cm3=transport_capacity,
                required_volume_cm3=required_volume,
                delivery_cost_per_transport=per_transport_cost,
                total_delivery_cost=total_cost,
            )
        )

    if not allocations:
        return None

    total_transport_count = sum(item.transport_count for item in allocations)
    total_cost = sum((item.total_delivery_cost for item in allocations), Decimal('0.00'))
    total_cost = total_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    avg_transport_cost = (
        (total_cost / total_transport_count).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if total_transport_count
        else Decimal('0.00')
    )
    return DeliveryPricingResult(
        transport=allocations[0].transport,
        transport_count=total_transport_count,
        distance_km=distance_km.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        delivery_cost_per_transport=avg_transport_cost,
        total_delivery_cost=total_cost,
        total_volume_cm3=total_volume,
        total_capacity_cm3=total_capacity_cm3,
        allocations=tuple(allocations),
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

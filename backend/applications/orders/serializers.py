"""Serializers for the order API."""

from __future__ import annotations

from collections import OrderedDict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from django.db import transaction

from rest_framework import serializers

from applications.customers.models import Customer
from applications.products.choices import RentalMode
from applications.products.models import Product

from .models import DeliveryType, Order, OrderItem, OrderStatus


class CustomerSummarySerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ('id', 'display_name')
        read_only_fields = ('id', 'display_name')

    def get_display_name(self, obj: Customer) -> str:
        return obj.display_name or obj.full_name or obj.email or str(obj.pk)


class OrderProductSummarySerializer(serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ('id', 'name', 'price_rub', 'color', 'thumbnail_url')

    def get_thumbnail_url(self, obj: Product) -> str | None:
        thumbnail = obj.thumbnail
        return thumbnail.url if thumbnail else None


def _load_product_rental_tiers(product: Product) -> list[tuple[int, Decimal]]:
    tiers: list[tuple[int, Decimal]] = []
    for tier in product.rental_special_tiers or []:
        try:
            end_day = int(tier.get('end_day'))
            price = Decimal(str(tier.get('price_per_day')))
        except (TypeError, ValueError, InvalidOperation):
            continue
        tiers.append((end_day, price))
    tiers.sort(key=lambda item: item[0])
    return tiers


def _snapshot_rental_tiers(tiers: list[tuple[int, Decimal]]) -> list[dict[str, str]]:
    return [{'end_day': end_day, 'price_per_day': format(price, '.2f')} for end_day, price in tiers]


def _calculate_rental_total(
    base_price: Decimal, mode: str, tiers: list[tuple[int, Decimal]], days: int
) -> Decimal:
    if days <= 0:
        raise ValueError('rental_days must be positive')
    if mode != RentalMode.SPECIAL:
        return base_price * days
    total = base_price
    if days == 1:
        return total
    previous_end = 1
    last_price = tiers[-1][1] if tiers else base_price
    for end_day, price_per_day in tiers:
        if end_day <= previous_end:
            last_price = price_per_day
            continue
        span_start = previous_end + 1
        span_end = min(end_day, days)
        if span_end < span_start:
            previous_end = end_day
            last_price = price_per_day
            continue
        days_in_span = span_end - span_start + 1
        total += price_per_day * days_in_span
        previous_end = end_day
        last_price = price_per_day
        if span_end == days:
            break
    if previous_end < days:
        total += last_price * (days - previous_end)
    return total


class OrderItemSerializer(serializers.ModelSerializer):
    product = OrderProductSummarySerializer(read_only=True)
    subtotal = serializers.SerializerMethodField()
    rental_tiers = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            'id',
            'product',
            'product_name',
            'quantity',
            'rental_days',
            'rental_mode',
            'rental_tiers',
            'unit_price',
            'subtotal',
        )
        read_only_fields = (
            'id',
            'product',
            'product_name',
            'rental_days',
            'rental_mode',
            'rental_tiers',
            'unit_price',
            'subtotal',
        )

    def get_subtotal(self, obj: OrderItem) -> Decimal:
        return obj.subtotal

    def get_rental_tiers(self, obj: OrderItem):
        if obj.rental_mode != RentalMode.SPECIAL:
            return None
        tiers = []
        for tier in obj.rental_tiers_snapshot or []:
            try:
                end_day = int(tier.get('end_day'))
                price = float(Decimal(str(tier.get('price_per_day'))))
            except (TypeError, ValueError, InvalidOperation):
                continue
            tiers.append({'end_day': end_day, 'price_per_day': price})
        tiers.sort(key=lambda item: item['end_day'])
        return tiers


class OrderSummarySerializer(serializers.ModelSerializer):
    customer = CustomerSummarySerializer(read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    delivery_type_label = serializers.CharField(source='get_delivery_type_display', read_only=True)

    class Meta:
        model = Order
        fields = (
            'id',
            'status',
            'status_label',
            'total_amount',
            'installation_date',
            'dismantle_date',
            'customer',
            'delivery_type',
            'delivery_type_label',
            'delivery_address',
            'comment',
            'created',
            'modified',
        )
        read_only_fields = ('id', 'total_amount', 'created', 'modified')


class OrderDetailSerializer(OrderSummarySerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta(OrderSummarySerializer.Meta):
        fields = OrderSummarySerializer.Meta.fields + ('items',)


class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    rental_days = serializers.IntegerField(min_value=1, required=False, default=1)
    rental_mode = serializers.ChoiceField(choices=RentalMode.choices, required=False)
    rental_tiers = serializers.ListField(child=serializers.DictField(), required=False)


def _derive_rental_days(installation: date | None, dismantle: date | None) -> int | None:
    if not installation or not dismantle:
        return None
    delta = (dismantle - installation).days + 1
    if delta <= 0:
        return None
    return delta


def _calculate_items_pricing(
    items_data: list[dict[str, Any]],
    default_rental_days: int | None,
) -> tuple[list[dict[str, Any]], Decimal]:
    if not items_data:
        return [], Decimal('0.00')

    product_ids = {str(item['product_id']) for item in items_data}
    products_qs = (
        Product.objects.filter(pk__in=product_ids)
        .select_related('setup_installer_qualification')
        .prefetch_related('complementary_products__setup_installer_qualification')
    )
    products = {str(product.pk): product for product in products_qs}

    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise serializers.ValidationError({'items': f"Товар {missing[0]} не найден"})

    calculated: OrderedDict[tuple[str, int], dict[str, Any]] = OrderedDict()
    qualification_total = Decimal('0.00')
    seen_products: set[str] = set()

    def _add_product_item(product: Product, quantity: int, rental_days: int) -> None:
        nonlocal qualification_total
        if quantity <= 0:
            return

        mode = product.rental_mode or RentalMode.STANDARD
        tiers = _load_product_rental_tiers(product) if mode == RentalMode.SPECIAL else []
        unit_total = _calculate_rental_total(
            Decimal(product.price_rub), mode, tiers, rental_days
        )
        unit_price = unit_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        subtotal_increment = unit_price * quantity
        tiers_snapshot = _snapshot_rental_tiers(tiers) if mode == RentalMode.SPECIAL else []

        key = (str(product.pk), rental_days)
        existing = calculated.get(key)
        if existing:
            existing['quantity'] += quantity
            existing['subtotal'] += subtotal_increment
        else:
            calculated[key] = {
                'product': product,
                'product_name': product.name,
                'quantity': quantity,
                'unit_price': unit_price,
                'rental_days': rental_days,
                'rental_mode': mode,
                'rental_tiers_snapshot': tiers_snapshot,
                'subtotal': subtotal_increment,
            }

        product_key = str(product.pk)
        if product_key not in seen_products:
            seen_products.add(product_key)
            qualification = product.setup_installer_qualification
            if qualification:
                qualification_total += qualification.price_rub or Decimal('0.00')

    for item in items_data:
        product_id = str(item['product_id'])
        product = products.get(product_id)
        if product is None:  # pragma: no cover - safeguarded by pre-check above
            raise serializers.ValidationError({'items': f"Товар {product_id} не найден"})

        try:
            quantity = int(item['quantity'])
        except (TypeError, ValueError):
            raise serializers.ValidationError({'items': 'Количество должно быть числом.'})

        if quantity <= 0:
            raise serializers.ValidationError({'items': 'Количество должно быть больше нуля.'})

        raw_rental_days = item.get('rental_days')
        if raw_rental_days in (None, '') and default_rental_days is not None:
            rental_days = default_rental_days
        else:
            try:
                rental_days = int(raw_rental_days or default_rental_days or 1)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    {'items': 'Количество дней аренды должно быть числом.'}
                )

        if rental_days <= 0:
            raise serializers.ValidationError(
                {'items': 'Количество дней аренды должно быть больше нуля.'}
            )

        _add_product_item(product, quantity, rental_days)

        for complementary in product.complementary_products.all():
            if complementary.pk == product.pk:
                continue
            _add_product_item(complementary, quantity, rental_days)

    return list(calculated.values()), qualification_total


class OrderWriteSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(
        choices=OrderStatus.choices, default=OrderStatus.NEW, required=False
    )
    customer_id = serializers.PrimaryKeyRelatedField(
        source='customer', queryset=Customer.objects.all(), allow_null=True, required=False
    )
    delivery_address = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    comment = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    items = OrderItemInputSerializer(many=True)

    class Meta:
        model = Order
        fields = (
            'status',
            'installation_date',
            'dismantle_date',
            'customer_id',
            'delivery_type',
            'delivery_address',
            'comment',
            'items',
        )

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._default_rental_days: int | None = None

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        delivery_type = attrs.get('delivery_type') or getattr(self.instance, 'delivery_type', None)
        delivery_address_input = attrs.get('delivery_address', serializers.empty)
        if delivery_address_input is serializers.empty:
            delivery_address = getattr(self.instance, 'delivery_address', '')
        elif delivery_address_input in (None, ''):
            delivery_address = ''
            attrs['delivery_address'] = ''
        else:
            delivery_address = delivery_address_input
        if delivery_type == DeliveryType.DELIVERY and not delivery_address:
            raise serializers.ValidationError(
                {'delivery_address': 'Укажите адрес доставки или выберите самовывоз.'}
            )

        installation_date = attrs.get('installation_date') or getattr(
            self.instance, 'installation_date', None
        )
        dismantle_date = attrs.get('dismantle_date') or getattr(
            self.instance, 'dismantle_date', None
        )
        if installation_date and dismantle_date and dismantle_date < installation_date:
            raise serializers.ValidationError(
                {'dismantle_date': 'Дата демонтажа должна быть не раньше даты монтажа.'}
            )

        self._default_rental_days = _derive_rental_days(installation_date, dismantle_date)

        items = attrs.get('items')
        if items is not None and len(items) == 0:
            raise serializers.ValidationError({'items': 'Добавьте хотя бы один товар.'})
        if delivery_type == DeliveryType.PICKUP:
            attrs['delivery_address'] = ''
        if 'comment' in attrs and attrs['comment'] in (None, ''):
            attrs['comment'] = ''

        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> Order:
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        self._replace_items(order, items_data, self._default_rental_days)
        order.recalculate_total_amount()
        order.save(update_fields=['total_amount'])
        return order

    @transaction.atomic
    def update(self, instance: Order, validated_data: dict[str, Any]) -> Order:
        items_data = validated_data.pop('items', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            self._replace_items(instance, items_data, self._default_rental_days)
        instance.recalculate_total_amount()
        instance.save(update_fields=['total_amount'])
        return instance

    def _replace_items(
        self,
        order: Order,
        items_data: list[dict[str, Any]],
        default_rental_days: int | None,
    ) -> None:
        calculated_items, _ = _calculate_items_pricing(items_data, default_rental_days)
        order_items = [
            OrderItem(
                order=order,
                product=item['product'],
                product_name=item['product_name'],
                quantity=item['quantity'],
                unit_price=item['unit_price'],
                rental_days=item['rental_days'],
                rental_mode=item['rental_mode'],
                rental_tiers_snapshot=item['rental_tiers_snapshot'],
            )
            for item in calculated_items
        ]
        OrderItem.objects.bulk_create(order_items)


class OrderCalculationSerializer(OrderWriteSerializer):
    class Meta(OrderWriteSerializer.Meta):
        pass

    def calculate(self) -> dict[str, Any]:
        items_data = self.validated_data.get('items', [])
        calculated_items, qualification_total = _calculate_items_pricing(
            items_data, self._default_rental_days
        )
        total = sum((item['subtotal'] for item in calculated_items), Decimal('0.00'))
        total += qualification_total

        def _format_decimal(value: Decimal) -> str:
            return format(value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), '.2f')

        return {
            'total_amount': _format_decimal(total),
            'qualification_total': _format_decimal(qualification_total),
            'items': [
                {
                    'product_id': str(item['product'].pk),
                    'quantity': item['quantity'],
                    'rental_days': item['rental_days'],
                    'unit_price': _format_decimal(item['unit_price']),
                    'subtotal': _format_decimal(item['subtotal']),
                }
                for item in calculated_items
            ],
        }

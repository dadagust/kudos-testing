"""Serializers for the order API."""

from __future__ import annotations

from collections import OrderedDict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from django.db import transaction
from rest_framework import serializers

from applications.customers.models import Customer, PhoneNormalizer
from applications.products.choices import RentalMode
from applications.products.models import Product

from .models import (
    DeliveryType,
    LogisticsState,
    Order,
    OrderDriver,
    OrderItem,
    OrderStatus,
    PaymentStatus,
)
from .services.delivery_pricing import (
    DeliveryPricingError,
    calculate_delivery_pricing,
)
from .services.setup_pricing import build_setup_requirements, calculate_setup_pricing
from .services.stock import (
    collect_order_item_totals,
    ensure_order_stock_transactions,
    reset_order_transactions,
    validate_stock_availability,
)


class CustomerSummarySerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = (
            'id',
            'display_name',
            'phone',
        )
        read_only_fields = (
            'id',
            'display_name',
            'phone',
        )

    def get_display_name(self, obj: Customer) -> str:
        return obj.display_name or obj.full_name or obj.email or str(obj.pk)


class OrderProductSummarySerializer(serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id',
            'name',
            'price_rub',
            'color',
            'thumbnail_url',
        )

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


class OrderAddressValidationSerializer(serializers.Serializer):
    """Validate the payload for the address validation endpoint."""

    input = serializers.CharField(allow_blank=False, trim_whitespace=True)

    default_error_messages = {
        'blank': 'Укажите адрес для валидации.',
        'empty': 'Укажите адрес для валидации.',
    }

    def validate_input(self, value: str) -> str:
        value = (value or '').strip()
        if not value:
            self.fail('empty')
        return value


class OrderSummarySerializer(serializers.ModelSerializer):
    customer = CustomerSummarySerializer(read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    delivery_type_label = serializers.CharField(source='get_delivery_type_display', read_only=True)
    payment_status_label = serializers.CharField(
        source='get_payment_status_display',
        read_only=True,
    )
    logistics_state_label = serializers.SerializerMethodField()
    delivery_address = serializers.CharField(read_only=True)
    delivery_address_input = serializers.CharField(read_only=True)
    delivery_address_full = serializers.CharField(read_only=True)
    mount_datetime_from = serializers.TimeField(format='%H:%M', allow_null=True, read_only=True)
    mount_datetime_to = serializers.TimeField(format='%H:%M', allow_null=True, read_only=True)
    dismount_datetime_from = serializers.TimeField(format='%H:%M', allow_null=True, read_only=True)
    dismount_datetime_to = serializers.TimeField(format='%H:%M', allow_null=True, read_only=True)
    delivery_lat = serializers.DecimalField(
        max_digits=9, decimal_places=6, read_only=True, allow_null=True
    )
    delivery_lon = serializers.DecimalField(
        max_digits=9, decimal_places=6, read_only=True, allow_null=True
    )
    delivery_address_kind = serializers.CharField(read_only=True)
    delivery_address_precision = serializers.CharField(read_only=True)
    yandex_uri = serializers.CharField(read_only=True)
    has_exact_address = serializers.SerializerMethodField()
    warehouse_received_by = serializers.IntegerField(
        source='warehouse_received_by_id',
        read_only=True,
    )
    is_warehouse_received = serializers.BooleanField(
        read_only=True,
    )
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            'id',
            'status',
            'status_label',
            'payment_status',
            'payment_status_label',
            'logistics_state',
            'logistics_state_label',
            'total_amount',
            'services_total_amount',
            'delivery_total_amount',
            'installation_total_amount',
            'dismantle_total_amount',
            'installation_date',
            'mount_datetime_from',
            'mount_datetime_to',
            'dismantle_date',
            'dismount_datetime_from',
            'dismount_datetime_to',
            'shipment_date',
            'customer',
            'delivery_type',
            'delivery_type_label',
            'delivery_address',
            'delivery_address_input',
            'delivery_address_full',
            'delivery_lat',
            'delivery_lon',
            'delivery_address_kind',
            'delivery_address_precision',
            'yandex_uri',
            'has_exact_address',
            'comment',
            'comment_for_waybill',
            'warehouse_received_at',
            'warehouse_received_by',
            'is_warehouse_received',
            'items',
            'created',
            'modified',
        )
        read_only_fields = (
            'id',
            'total_amount',
            'services_total_amount',
            'delivery_total_amount',
            'installation_total_amount',
            'dismantle_total_amount',
            'created',
            'modified',
        )

    def get_logistics_state_label(self, obj: Order) -> str | None:
        state = obj.logistics_state
        if not state:
            return None
        return dict(LogisticsState.choices).get(state)

    def get_has_exact_address(self, obj: Order) -> bool:
        return obj.has_exact_address()


class OrderDetailSerializer(OrderSummarySerializer):
    class Meta(OrderSummarySerializer.Meta):
        fields = OrderSummarySerializer.Meta.fields


class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(
        min_value=1,
    )
    rental_days = serializers.IntegerField(
        min_value=1,
        required=False,
        default=1,
    )
    rental_mode = serializers.ChoiceField(
        choices=RentalMode.choices,
        required=False,
    )
    rental_tiers = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )


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
) -> tuple[list[dict[str, Any]], Decimal, dict[str, int]]:
    if not items_data:
        return [], Decimal('0.00'), {}

    product_ids = {str(item['product_id']) for item in items_data}
    products_qs = (
        Product.objects.filter(pk__in=product_ids)
        .select_related('setup_installer_qualification', 'delivery_transport_restriction')
        .prefetch_related('complementary_products__setup_installer_qualification')
    )
    products = {str(product.pk): product for product in products_qs}

    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise serializers.ValidationError({'items': f'Товар {missing[0]} не найден'})

    calculated: OrderedDict[tuple[str, int], dict[str, Any]] = OrderedDict()
    product_totals: dict[str, int] = {}

    def _add_product_item(product: Product, quantity: int, rental_days: int) -> None:
        if quantity <= 0:
            return

        mode = product.rental_mode or RentalMode.STANDARD
        tiers = _load_product_rental_tiers(product) if mode == RentalMode.SPECIAL else []
        unit_total = _calculate_rental_total(Decimal(product.price_rub), mode, tiers, rental_days)
        unit_price = unit_total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        subtotal_increment = unit_price * quantity
        tiers_snapshot = _snapshot_rental_tiers(tiers) if mode == RentalMode.SPECIAL else []

        product_id_str = str(product.pk)
        product_totals[product_id_str] = product_totals.get(product_id_str, 0) + quantity

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

    for item in items_data:
        product_id = str(item['product_id'])
        product = products.get(product_id)
        if product is None:
            raise serializers.ValidationError({'items': f'Товар {product_id} не найден'})

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

    return list(calculated.values()), product_totals, products


class OrderReturnItemInputSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=0)


class OrderPaymentStatusUpdateSerializer(serializers.Serializer):
    payment_status = serializers.ChoiceField(choices=PaymentStatus.choices)


class OrderLogisticsStateUpdateSerializer(serializers.Serializer):
    logistics_state = serializers.ChoiceField(
        choices=LogisticsState.choices,
        allow_null=True,
        required=False,
    )


class OrderReceiveSerializer(serializers.Serializer):
    received = serializers.BooleanField(required=False)


class OrderWriteSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(
        choices=OrderStatus.choices,
        default=OrderStatus.NEW,
        required=False,
    )
    payment_status = serializers.ChoiceField(
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        required=False,
    )
    logistics_state = serializers.ChoiceField(
        choices=LogisticsState.choices,
        required=False,
        allow_null=True,
    )
    customer_id = serializers.PrimaryKeyRelatedField(
        source='customer',
        queryset=Customer.objects.all(),
        allow_null=True,
        required=False,
    )
    delivery_address = serializers.CharField(
        source='delivery_address_input',
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    comment = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    comment_for_waybill = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    mount_datetime_from = serializers.TimeField(
        allow_null=True,
        required=False,
        format='%H:%M',
        input_formats=['%H:%M', '%H:%M:%S', 'iso-8601'],
    )
    mount_datetime_to = serializers.TimeField(
        allow_null=True,
        required=False,
        format='%H:%M',
        input_formats=['%H:%M', '%H:%M:%S', 'iso-8601'],
    )
    shipment_date = serializers.DateField(
        allow_null=True,
        required=False,
    )
    dismount_datetime_from = serializers.TimeField(
        allow_null=True,
        required=False,
        format='%H:%M',
        input_formats=['%H:%M', '%H:%M:%S', 'iso-8601'],
    )
    dismount_datetime_to = serializers.TimeField(
        allow_null=True,
        required=False,
        format='%H:%M',
        input_formats=['%H:%M', '%H:%M:%S', 'iso-8601'],
    )
    items = OrderItemInputSerializer(
        many=True,
    )
    return_items = OrderReturnItemInputSerializer(
        many=True,
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = Order
        fields = (
            'status',
            'payment_status',
            'logistics_state',
            'installation_date',
            'mount_datetime_from',
            'mount_datetime_to',
            'dismantle_date',
            'dismount_datetime_from',
            'dismount_datetime_to',
            'shipment_date',
            'customer_id',
            'delivery_type',
            'delivery_address',
            'comment',
            'comment_for_waybill',
            'items',
            'return_items',
        )

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._default_rental_days: int | None = None

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        delivery_type = attrs.get('delivery_type') or getattr(self.instance, 'delivery_type', None)
        delivery_address_input = attrs.get('delivery_address_input', serializers.empty)
        current_input = getattr(self.instance, 'delivery_address_input', '')
        current_full = getattr(self.instance, 'delivery_address_full', '')
        normalized_provided_input = None
        if delivery_address_input is serializers.empty:
            delivery_address = current_input or current_full
        elif delivery_address_input in (None, ''):
            delivery_address = ''
            attrs['delivery_address_input'] = ''
            normalized_provided_input = ''
        else:
            normalized_provided_input = str(delivery_address_input).strip()
            attrs['delivery_address_input'] = normalized_provided_input
            delivery_address = normalized_provided_input
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
            attrs['delivery_address_input'] = ''
            self._reset_delivery_metadata(attrs)
        elif normalized_provided_input is not None:
            if normalized_provided_input != (current_input or '').strip():
                self._reset_delivery_metadata(attrs)
        if 'comment' in attrs and attrs['comment'] in (None, ''):
            attrs['comment'] = ''
        if 'comment_for_waybill' in attrs and attrs['comment_for_waybill'] in (None, ''):
            attrs['comment_for_waybill'] = ''

        logistics_state = attrs.get('logistics_state', serializers.empty)
        if logistics_state == '':
            attrs['logistics_state'] = None

        status_value = attrs.get('status') or getattr(self.instance, 'status', None)
        return_items = attrs.get('return_items', serializers.empty)
        if status_value == OrderStatus.ARCHIVED:
            if return_items in (serializers.empty, None):
                raise serializers.ValidationError(
                    {'return_items': 'Укажите, сколько единиц товара вернулось на склад.'}
                )
        elif return_items not in (serializers.empty, None):
            attrs.pop('return_items', None)

        return attrs

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> Order:
        items_data = validated_data.pop('items', [])
        return_items_data = validated_data.pop('return_items', None)
        order = Order.objects.create(**validated_data)
        self._replace_items(
            order,
            items_data,
            self._default_rental_days,
            reserve_stock=order.status != OrderStatus.DECLINED,
        )
        if return_items_data:
            setattr(
                order, '_return_quantities', self._build_return_quantities(order, return_items_data)
            )
        ensure_order_stock_transactions(
            order,
            return_quantities=getattr(order, '_return_quantities', None),
        )
        if hasattr(order, '_return_quantities'):
            delattr(order, '_return_quantities')
        order.recalculate_total_amount()
        order.save(
            update_fields=[
                'total_amount',
                'services_total_amount',
                'installation_total_amount',
                'dismantle_total_amount',
                'delivery_total_amount',
            ]
        )
        return order

    @transaction.atomic
    def update(self, instance: Order, validated_data: dict[str, Any]) -> Order:
        items_data = validated_data.pop('items', None)
        return_items_data = validated_data.pop('return_items', None)
        previous_status = instance.status
        new_status = validated_data.get('status', previous_status)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items_data is not None:
            reset_order_transactions(instance)
            instance.items.all().delete()
            self._replace_items(
                instance,
                items_data,
                self._default_rental_days,
                reserve_stock=new_status != OrderStatus.DECLINED,
            )
        if return_items_data is not None:
            setattr(
                instance,
                '_return_quantities',
                self._build_return_quantities(instance, return_items_data),
            )
        elif hasattr(instance, '_return_quantities'):
            delattr(instance, '_return_quantities')
        ensure_order_stock_transactions(
            instance,
            return_quantities=getattr(instance, '_return_quantities', None),
        )
        if new_status != previous_status:
            product_totals = collect_order_item_totals(instance)
            if product_totals:
                if new_status == OrderStatus.DECLINED and previous_status != OrderStatus.DECLINED:
                    reset_order_transactions(instance)
                elif previous_status == OrderStatus.DECLINED and new_status != OrderStatus.DECLINED:
                    validate_stock_availability(product_totals)
                    ensure_order_stock_transactions(
                        instance,
                        return_quantities=getattr(instance, '_return_quantities', None),
                    )
        if hasattr(instance, '_return_quantities'):
            delattr(instance, '_return_quantities')
        instance.recalculate_total_amount()
        instance.save(
            update_fields=[
                'total_amount',
                'services_total_amount',
                'installation_total_amount',
                'dismantle_total_amount',
                'delivery_total_amount',
            ]
        )
        return instance

    @staticmethod
    def _reset_delivery_metadata(attrs: dict[str, Any]) -> None:
        attrs['delivery_address_full'] = ''
        attrs['delivery_lat'] = None
        attrs['delivery_lon'] = None
        attrs['delivery_address_kind'] = ''
        attrs['delivery_address_precision'] = ''
        attrs['yandex_uri'] = ''

    def _replace_items(
        self,
        order: Order,
        items_data: list[dict[str, Any]],
        default_rental_days: int | None,
        *,
        reserve_stock: bool,
    ) -> None:
        calculated_items, product_totals, _ = _calculate_items_pricing(
            items_data, default_rental_days
        )
        if reserve_stock and product_totals:
            validate_stock_availability(product_totals)
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

    def _build_return_quantities(
        self, order: Order, return_items: list[dict[str, Any]]
    ) -> dict[UUID, int]:
        totals: dict[UUID, int] = {}
        for item in order.items.select_related('product'):
            if not item.product_id:
                continue
            totals[item.product_id] = totals.get(item.product_id, 0) + item.quantity
        if not totals:
            raise serializers.ValidationError(
                {'return_items': 'Нечего возвращать: в заказе нет товаров.'}
            )
        result: dict[UUID, int] = {}
        for payload in return_items:
            product_id = payload['product_id']
            quantity = payload['quantity']
            if product_id not in totals:
                raise serializers.ValidationError(
                    {
                        'return_items': (
                            f'Товар {product_id} отсутствует в заказе и не может быть возвращён.'
                        )
                    }
                )
            ordered_quantity = totals[product_id]
            if quantity > ordered_quantity:
                raise serializers.ValidationError(
                    {
                        'return_items': (
                            'Количество возврата не может превышать заказанное. '
                            f'Для товара {product_id} заказано {ordered_quantity}, '
                            f'указано к возврату {quantity}.'
                        )
                    }
                )
            result[product_id] = quantity
        missing = [pid for pid in totals.keys() if pid not in result]
        if missing:
            raise serializers.ValidationError(
                {
                    'return_items': (
                        'Укажите количество возврата для всех товаров заказа. '
                        f'Отсутствуют: {", ".join(str(pid) for pid in missing)}.'
                    )
                }
            )
        return result


class OrderCalculationSerializer(OrderWriteSerializer):
    class Meta(OrderWriteSerializer.Meta):
        pass

    def calculate(self) -> dict[str, Any]:
        items_data = self.validated_data.get('items', [])
        calculated_items, product_totals, products = _calculate_items_pricing(
            items_data, self._default_rental_days
        )
        total = sum((item['subtotal'] for item in calculated_items), Decimal('0.00'))
        setup_requirements = build_setup_requirements(product_totals, products)
        setup_pricing = calculate_setup_pricing(setup_requirements)
        total += setup_pricing.services_total
        delivery_total = Decimal('0.00')
        delivery_details: dict[str, Any] | None = None
        delivery_type = self.validated_data.get('delivery_type', DeliveryType.DELIVERY)
        delivery_address = (
            self.validated_data.get('delivery_address_input')
            or self.validated_data.get('delivery_address_full')
            or ''
        )
        if product_totals and delivery_type == DeliveryType.DELIVERY:
            try:
                delivery_pricing = calculate_delivery_pricing(
                    delivery_type=delivery_type,
                    delivery_address=delivery_address,
                    product_totals=product_totals,
                    products=products,
                )
            except DeliveryPricingError as exc:
                raise serializers.ValidationError({'delivery': str(exc)}) from exc
            if delivery_pricing:
                delivery_total = delivery_pricing.total_delivery_cost
                delivery_details = {
                    'transport': {
                        'value': delivery_pricing.transport.value,
                        'label': delivery_pricing.transport.label,
                    },
                    'transport_count': delivery_pricing.transport_count,
                    'distance_km': format(
                        delivery_pricing.distance_km.quantize(
                            Decimal('0.01'), rounding=ROUND_HALF_UP
                        ),
                        '.2f',
                    ),
                    'cost_per_transport': format(
                        delivery_pricing.delivery_cost_per_transport, '.2f'
                    ),
                }
        total += delivery_total

        def _format_decimal(value: Decimal) -> str:
            return format(value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), '.2f')

        return {
            'total_amount': _format_decimal(total),
            'services_total_amount': _format_decimal(setup_pricing.services_total + delivery_total),
            'installation_total_amount': _format_decimal(setup_pricing.installation_total),
            'dismantle_total_amount': _format_decimal(setup_pricing.dismantle_total),
            'delivery_total_amount': _format_decimal(delivery_total),
            'delivery_pricing': delivery_details,
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


class OrderDriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderDriver
        fields = (
            'id',
            'full_name',
            'phone',
            'created',
            'modified',
        )
        read_only_fields = (
            'id',
            'created',
            'modified',
        )


class OrderDriverAssignSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=32)

    default_error_messages = {
        'full_name_blank': 'Укажите имя водителя.',
        'phone_blank': 'Укажите телефон водителя.',
        'phone_invalid': 'Некорректный номер телефона.',
    }

    def validate_full_name(self, value: str) -> str:
        normalized = (value or '').strip()
        if not normalized:
            self.fail('full_name_blank')
        return normalized

    def validate_phone(self, value: str) -> str:
        normalized = (value or '').strip()
        if not normalized:
            self.fail('phone_blank')
        digits = ''.join(ch for ch in normalized if ch.isdigit())
        if len(digits) < 10:
            self.fail('phone_invalid')
        normalized_phone = PhoneNormalizer.normalize(normalized)
        if not normalized_phone:
            self.fail('phone_invalid')
        return normalized_phone

"""Serializers for the order API."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db import transaction
from rest_framework import serializers

from applications.customers.models import Customer
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


class OrderItemSerializer(serializers.ModelSerializer):
    product = OrderProductSummarySerializer(read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            'id',
            'product',
            'product_name',
            'quantity',
            'unit_price',
            'subtotal',
        )
        read_only_fields = ('id', 'product', 'product_name', 'unit_price', 'subtotal')

    def get_subtotal(self, obj: OrderItem) -> Decimal:
        return obj.subtotal


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

    def validate_product_id(self, value):
        try:
            product = Product.objects.get(pk=value)
        except Product.DoesNotExist as exc:  # pragma: no cover - validated via serializer
            raise serializers.ValidationError('Товар не найден') from exc
        return value


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
        self._replace_items(order, items_data)
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
            self._replace_items(instance, items_data)
        instance.recalculate_total_amount()
        instance.save(update_fields=['total_amount'])
        return instance

    def _replace_items(self, order: Order, items_data: list[dict[str, Any]]) -> None:
        order_items: list[OrderItem] = []
        for item in items_data:
            product_id = item['product_id']
            quantity = int(item['quantity'])
            product = Product.objects.get(pk=product_id)
            order_items.append(
                OrderItem(
                    order=order,
                    product=product,
                    product_name=product.name,
                    quantity=quantity,
                    unit_price=product.price_rub,
                )
            )
        OrderItem.objects.bulk_create(order_items)

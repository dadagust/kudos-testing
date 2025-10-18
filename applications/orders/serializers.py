"""Serializers for the order management REST API."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db import transaction
from rest_framework import serializers

from applications.customers.models import Customer

from .models import DeliveryMethod, Order, OrderItem, ProductCode


class OrderItemInputSerializer(serializers.Serializer):
    product = serializers.ChoiceField(choices=ProductCode.choices)
    quantity = serializers.IntegerField(min_value=1, default=1)


class OrderItemSerializer(serializers.ModelSerializer):
    product_label = serializers.CharField(source='get_product_display', read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            'id',
            'product',
            'product_label',
            'quantity',
            'unit_price',
            'total_price',
        )
        read_only_fields = ('id', 'unit_price', 'total_price')


class OrderListSerializer(serializers.ModelSerializer):
    number = serializers.CharField(read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id',
            'number',
            'status',
            'status_label',
            'total_amount',
            'installation_date',
            'dismantle_date',
            'customer',
            'customer_name',
            'delivery_method',
            'delivery_address',
            'comment',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'number',
            'total_amount',
            'created_at',
            'updated_at',
        )

    def get_customer_name(self, obj: Order) -> str:
        customer = obj.customer
        if not customer:
            return '—'
        return customer.display_name or customer.full_name or customer.email or str(customer.pk)


class OrderDetailSerializer(OrderListSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta(OrderListSerializer.Meta):
        fields = OrderListSerializer.Meta.fields + (
            'items',
        )


class OrderWriteSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source='customer', queryset=Customer.objects.filter(is_active=True), allow_null=True, required=False
    )
    items = OrderItemInputSerializer(many=True)
    delivery_address = serializers.CharField(required=False, allow_blank=True)
    comment = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Order
        fields = (
            'status',
            'installation_date',
            'dismantle_date',
            'customer_id',
            'delivery_method',
            'delivery_address',
            'comment',
            'items',
        )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        installation = attrs.get('installation_date') or getattr(self.instance, 'installation_date', None)
        dismantle = attrs.get('dismantle_date') or getattr(self.instance, 'dismantle_date', None)
        if installation and dismantle and dismantle < installation:
            raise serializers.ValidationError(
                {'dismantle_date': 'Дата демонтажа не может быть раньше даты монтажа.'}
            )

        delivery_method = attrs.get('delivery_method') or getattr(
            self.instance, 'delivery_method', DeliveryMethod.DELIVERY
        )
        delivery_address = attrs.get(
            'delivery_address', getattr(self.instance, 'delivery_address', '') if self.instance else ''
        )
        if delivery_method == DeliveryMethod.DELIVERY and not (delivery_address or '').strip():
            raise serializers.ValidationError({'delivery_address': 'Укажите адрес доставки.'})
        if delivery_method == DeliveryMethod.PICKUP:
            attrs['delivery_address'] = ''
        return attrs

    def validate_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not items:
            raise serializers.ValidationError('Добавьте хотя бы один товар.')
        return items

    def create(self, validated_data: dict[str, Any]) -> Order:
        items = validated_data.pop('items')
        with transaction.atomic():
            order = Order.objects.create(**validated_data)
            self._sync_items(order, items)
            return order

    def update(self, instance: Order, validated_data: dict[str, Any]) -> Order:
        items = validated_data.pop('items', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        with transaction.atomic():
            instance.save()
            if items is not None:
                instance.items.all().delete()
                self._sync_items(instance, items)
            else:
                instance.reset_totals()
        return instance

    def _sync_items(self, order: Order, items: list[dict[str, Any]]) -> None:
        total = Decimal('0')
        for payload in items:
            product = payload['product']
            quantity = payload.get('quantity') or 1
            unit_price = OrderItem.get_unit_price(product)
            total_price = unit_price * Decimal(quantity)
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
            )
            total += total_price
        order.total_amount = total
        order.save(update_fields=['total_amount', 'updated_at'])


__all__ = [
    'OrderDetailSerializer',
    'OrderItemSerializer',
    'OrderListSerializer',
    'OrderWriteSerializer',
]

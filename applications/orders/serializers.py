"""Serializers for order REST API."""

from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from .models import DeliveryOption, Order, OrderItem, ProductChoices


class OrderItemSerializer(serializers.ModelSerializer):
    product_label = serializers.CharField(source='get_product_display', read_only=True)
    unit_price = serializers.SerializerMethodField()
    amount = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            'id',
            'product',
            'product_label',
            'quantity',
            'unit_price',
            'amount',
            'created',
            'modified',
        )
        read_only_fields = (
            'id',
            'product_label',
            'unit_price',
            'amount',
            'created',
            'modified',
        )

    def get_unit_price(self, obj: OrderItem) -> str:
        return f'{obj.unit_price:.2f}'

    def get_amount(self, obj: OrderItem) -> str:
        return f'{obj.amount:.2f}'


class OrderItemWriteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = OrderItem
        fields = ('id', 'product', 'quantity')

    def validate_quantity(self, value: int) -> int:
        if value <= 0:
            raise serializers.ValidationError('Количество должно быть больше нуля.')
        return value

    def validate_product(self, value: str) -> str:
        if value not in ProductChoices.values:
            raise serializers.ValidationError('Недопустимый товар.')
        return value


class OrderSummarySerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    delivery_option_label = serializers.CharField(source='get_delivery_option_display', read_only=True)
    customer_name = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

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
            'customer_name',
            'delivery_option',
            'delivery_option_label',
            'delivery_address',
            'comment',
            'created',
            'modified',
        )
        read_only_fields = ('created', 'modified')

    def get_customer_name(self, obj: Order) -> str:
        if obj.customer:
            return obj.customer.display_name or obj.customer.full_name or str(obj.customer)
        return ''

    def get_total_amount(self, obj: Order) -> str:
        return f'{obj.total_amount:.2f}'


class OrderDetailSerializer(OrderSummarySerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta(OrderSummarySerializer.Meta):
        fields = OrderSummarySerializer.Meta.fields + ('items',)


class OrderWriteSerializer(serializers.ModelSerializer):
    items = OrderItemWriteSerializer(many=True)

    class Meta:
        model = Order
        fields = (
            'status',
            'installation_date',
            'dismantle_date',
            'customer',
            'delivery_option',
            'delivery_address',
            'comment',
            'items',
        )

    def validate(self, attrs):
        installation = attrs.get('installation_date')
        dismantle = attrs.get('dismantle_date')
        if installation and dismantle and dismantle < installation:
            raise serializers.ValidationError('Дата демонтажа не может быть раньше даты монтажа.')

        delivery_option = attrs.get('delivery_option')
        delivery_address = attrs.get('delivery_address')
        if delivery_option == DeliveryOption.DELIVERY and not delivery_address:
            raise serializers.ValidationError(
                {'delivery_address': 'Укажите адрес доставки или выберите самовывоз.'}
            )
        if delivery_option == DeliveryOption.PICKUP:
            attrs['delivery_address'] = ''
        return attrs

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('Добавьте хотя бы один товар в заказ.')
        return value

    def _sync_items(self, order: Order, items_data: list[dict]) -> None:
        existing_items = {item.id: item for item in order.items.all()}
        seen_ids: set[int] = set()

        for item_data in items_data:
            item_id = item_data.get('id')
            if item_id and item_id in existing_items:
                item = existing_items[item_id]
                item.product = item_data['product']
                item.quantity = item_data['quantity']
                item.save()
                seen_ids.add(item_id)
            else:
                OrderItem.objects.create(order=order, **item_data)

        for item_id, item in existing_items.items():
            if item_id not in seen_ids:
                item.delete()

        order.refresh_from_db(fields=('total_amount',))

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        created_by = getattr(getattr(request, 'user', None), 'id', None)
        if created_by:
            validated_data.setdefault('created_by_id', created_by)
        order = Order.objects.create(**validated_data)
        self._sync_items(order, items_data)
        return order

    @transaction.atomic
    def update(self, instance: Order, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            self._sync_items(instance, items_data)
        else:
            instance.refresh_from_db(fields=('total_amount',))
        return instance


__all__ = [
    'OrderDetailSerializer',
    'OrderSummarySerializer',
    'OrderWriteSerializer',
    'OrderItemSerializer',
]

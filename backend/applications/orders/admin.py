"""Admin registrations for the order domain."""

from __future__ import annotations

from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    raw_id_fields = (
        'order',
        'product',
    )
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'status',
        'installation_date',
        'dismantle_date',
        'customer',
        'total_amount',
        'delivery_type',
        'created',
    )
    list_filter = (
        'status',
        'delivery_type',
        'installation_date',
    )
    search_fields = (
        'id',
        'comment',
        'delivery_address',
        'customer__display_name',
    )
    raw_id_fields = ('customer',)
    inlines = (OrderItemInline,)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        'order',
        'product',
        'quantity',
        'unit_price',
        'subtotal',
    )
    list_filter = ('product',)
    search_fields = (
        'order__id',
        'product__name',
    )
    raw_id_fields = (
        'order',
        'product',
    )

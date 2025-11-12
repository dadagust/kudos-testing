"""Admin registrations for the order domain."""

from __future__ import annotations

from django.contrib import admin

from .models import Order, OrderDriver, OrderItem


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
        'comment_for_waybill',
        'delivery_address_input',
        'delivery_address_full',
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


@admin.register(OrderDriver)
class OrderDriverAdmin(admin.ModelAdmin):
    list_display = (
        'order',
        'full_name',
        'phone',
        'created',
    )
    search_fields = (
        'order__id',
        'full_name',
        'phone',
        'phone_normalized',
    )
    raw_id_fields = ('order',)

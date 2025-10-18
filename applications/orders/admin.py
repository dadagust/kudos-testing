"""Admin configuration for orders."""

from __future__ import annotations

from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ('product', 'quantity', 'unit_price', 'total_price')
    readonly_fields = ('unit_price', 'total_price')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'number',
        'status',
        'installation_date',
        'dismantle_date',
        'customer',
        'total_amount',
    )
    list_filter = ('status', 'delivery_method')
    search_fields = (
        'id',
        'delivery_address',
        'comment',
        'customer__display_name',
        'customer__first_name',
        'customer__last_name',
    )
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity', 'unit_price', 'total_price')
    list_filter = ('product',)
    search_fields = ('order__id', 'order__customer__display_name')


__all__ = ['OrderAdmin', 'OrderItemAdmin']

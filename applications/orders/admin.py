from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'status',
        'installation_date',
        'dismantle_date',
        'customer',
        'delivery_option',
        'total_amount',
    )
    list_filter = ('status', 'delivery_option')
    search_fields = ('id', 'customer__display_name')
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity')
    list_filter = ('product',)

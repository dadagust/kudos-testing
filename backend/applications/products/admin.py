"""Admin registrations for product models."""

from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Category,
    Color,
    InstallerQualification,
    Product,
    ProductGroup,
    ProductImage,
    StockTransaction,
    TransportRestriction,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    readonly_fields = ('preview',)

    def preview(self, obj):  # pragma: no cover - admin helper
        if obj.file:
            return f'<img src="{obj.file.url}" style="max-height: 80px" />'
        return '—'

    preview.allow_tags = True  # type: ignore[attr-defined]
    preview.short_description = 'Превью'


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        'image_preview',
        'name',
        'slug',
        'parent',
    )
    search_fields = (
        'name',
        'slug',
    )
    list_filter = ('parent',)
    raw_id_fields = ('parent',)
    readonly_fields = ('image_preview',)
    fields = (
        'name',
        'slug',
        'parent',
        'image',
        'image_preview',
    )

    @admin.display(description='Фото')
    def image_preview(self, obj):  # pragma: no cover - admin helper
        if obj.image:
            return format_html('<img src="{}" style="max-height: 80px" />', obj.image.url)
        return '—'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'category',
        'price_rub',
        'color',
        'created',
    )
    search_fields = (
        'name',
        'seo_url_name',
    )
    list_filter = (
        'category',
        'color',
        'visibility_show_on_site',
    )
    raw_id_fields = (
        'category',
        'color',
    )
    inlines = (ProductImageInline,)


@admin.register(ProductGroup)
class ProductGroupAdmin(admin.ModelAdmin):
    list_display = (
        'category',
        'name',
        'created',
        'modified',
    )
    search_fields = ('name', 'category__name')
    filter_horizontal = ('products',)
    autocomplete_fields = ('category',)


@admin.register(InstallerQualification)
class InstallerQualificationAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'price_rub',
        'minimal_price_rub',
        'hour_price_rub',
        'created',
        'modified',
    )
    search_fields = ('name',)
    fields = (
        'name',
        'price_rub',
        'minimal_price_rub',
        'hour_price_rub',
        'created',
        'modified',
    )
    readonly_fields = ('created', 'modified')


@admin.register(Color)
class ColorAdmin(admin.ModelAdmin):
    list_display = (
        'label',
        'value',
        'created',
        'modified',
    )
    search_fields = (
        'label',
        'value',
    )


@admin.register(TransportRestriction)
class TransportRestrictionAdmin(admin.ModelAdmin):
    list_display = (
        'label',
        'value',
        'capacity_volume_cm3',
        'cost_per_km_rub',
        'cost_per_transport_rub',
        'created',
        'modified',
    )
    search_fields = (
        'label',
        'value',
    )


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'product',
        'quantity_delta',
        'affects_stock',
        'affects_available',
        'is_applied',
        'scheduled_for',
        'order',
        'order_transaction_type',
        'created_by_name',
        'created',
    )
    list_filter = (
        'affects_stock',
        'affects_available',
        'is_applied',
        'product',
        'order_transaction_type',
    )
    search_fields = (
        'product__name',
        'created_by_name',
        'note',
    )
    readonly_fields = (
        'created',
        'modified',
    )
    raw_id_fields = (
        'product',
        'created_by',
        'order',
    )

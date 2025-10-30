"""Admin registrations for product models."""

from django.contrib import admin

from .models import (
    Category,
    Color,
    InstallerQualification,
    Product,
    ProductImage,
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


@admin.register(InstallerQualification)
class InstallerQualificationAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'price_rub',
        'created',
        'modified',
    )
    search_fields = ('name',)


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
        'created',
        'modified',
    )
    search_fields = (
        'label',
        'value',
    )

"""Admin registrations for product models."""

from django.contrib import admin

from .models import Category, Product, ProductImage


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
    list_display = ('name', 'slug', 'parent')
    search_fields = ('name', 'slug')
    list_filter = ('parent',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price_rub', 'color', 'created')
    search_fields = ('name', 'seo_url_name')
    list_filter = ('category', 'color')
    inlines = [ProductImageInline]

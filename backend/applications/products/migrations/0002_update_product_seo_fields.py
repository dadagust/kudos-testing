from __future__ import annotations

from django.db import migrations, models
from django.utils.text import slugify


def generate_url_name(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    existing = set(
        Product.objects.exclude(seo_url_name__isnull=True)
        .exclude(seo_url_name='')
        .values_list('seo_url_name', flat=True)
    )
    for product in Product.objects.all():
        if product.seo_url_name:
            slug = product.seo_url_name
        else:
            base = slugify(product.name, allow_unicode=True)
            if not base:
                base = slugify(str(product.pk), allow_unicode=True) or str(product.pk)
            slug = base
            suffix = 2
            while slug in existing:
                slug = f"{base}-{suffix}"
                suffix += 1
        existing.add(slug)
        Product.objects.filter(pk=product.pk).update(seo_url_name=slug)


def reverse_noop(apps, schema_editor):
    # Removing generated URL names is not supported; no-op.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='product',
            old_name='seo_slug',
            new_name='seo_url_name',
        ),
        migrations.RemoveField(
            model_name='product',
            name='seo_meta_keywords',
        ),
        migrations.RunPython(generate_url_name, reverse_noop),
        migrations.AlterField(
            model_name='product',
            name='seo_url_name',
            field=models.SlugField(max_length=255, unique=True, verbose_name='URL имя'),
        ),
    ]

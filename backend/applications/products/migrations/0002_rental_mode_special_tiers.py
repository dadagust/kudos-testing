from __future__ import annotations

from django.db import migrations, models
from django.db.models import Q


def set_default_rental_mode(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    Product.objects.filter(Q(rental_mode__isnull=True) | Q(rental_mode='')).update(
        rental_mode='standard'
    )


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='product',
            old_name='rental_base_period',
            new_name='rental_mode',
        ),
        migrations.AddField(
            model_name='product',
            name='rental_special_tiers',
            field=models.JSONField(
                blank=True,
                default=list,
                verbose_name='Тарифы аренды (особый)',
            ),
        ),
        migrations.RunPython(set_default_rental_mode, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='product',
            name='rental_mode',
            field=models.CharField(
                choices=[
                    ('standard', 'Стандартный'),
                    ('special', 'Особый'),
                ],
                default='standard',
                max_length=32,
                verbose_name='Режим аренды',
            ),
        ),
    ]

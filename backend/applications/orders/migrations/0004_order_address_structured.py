"""Introduce structured delivery address fields."""

from django.db import migrations, models


def copy_delivery_address_forward(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    for order in Order.objects.exclude(delivery_address=''):
        raw = order.delivery_address or ''
        order.delivery_address_input = raw
        order.delivery_address_full = raw
        order.save(update_fields=['delivery_address_input', 'delivery_address_full'])


def copy_delivery_address_backward(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    for order in Order.objects.exclude(delivery_address_input=''):
        order.delivery_address = order.delivery_address_full or order.delivery_address_input
        order.save(update_fields=['delivery_address'])


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_order_logistics_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='delivery_address_input',
            field=models.CharField(
                blank=True,
                max_length=255,
                verbose_name='Адрес доставки (ввод)',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_address_full',
            field=models.CharField(
                blank=True,
                max_length=512,
                verbose_name='Адрес доставки (нормализованный)',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_lat',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name='Широта',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_lon',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name='Долгота',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_address_kind',
            field=models.CharField(
                blank=True,
                max_length=32,
                verbose_name='Тип объекта (kind)',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_address_precision',
            field=models.CharField(
                blank=True,
                max_length=32,
                verbose_name='Точность (precision)',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='yandex_uri',
            field=models.CharField(
                blank=True,
                max_length=255,
                verbose_name='URI в Яндекс',
            ),
        ),
        migrations.RunPython(
            copy_delivery_address_forward,
            reverse_code=copy_delivery_address_backward,
        ),
        migrations.RemoveField(
            model_name='order',
            name='delivery_address',
        ),
    ]

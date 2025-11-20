from __future__ import annotations

from django.db import migrations, models

WAREHOUSE_ADDRESS_DEFAULT = '105187, г. Москва, г. Москва, Вернисажная ул., 6'


def create_default_delivery_settings(apps, schema_editor):
    DeliverySettings = apps.get_model('orders', 'DeliverySettings')
    if not DeliverySettings.objects.exists():
        DeliverySettings.objects.create(warehouse_address=WAREHOUSE_ADDRESS_DEFAULT)


def remove_delivery_settings(apps, schema_editor):
    DeliverySettings = apps.get_model('orders', 'DeliverySettings')
    DeliverySettings.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0005_order_service_breakdown'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeliverySettings',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                (
                    'created',
                    models.DateTimeField(auto_now_add=True, verbose_name='Дата создания'),
                ),
                (
                    'modified',
                    models.DateTimeField(auto_now=True, verbose_name='Дата изменения'),
                ),
                (
                    'warehouse_address',
                    models.CharField(
                        default=WAREHOUSE_ADDRESS_DEFAULT,
                        help_text='Адрес отправки заказов для расчёта маршрута доставки.',
                        max_length=512,
                        verbose_name='Адрес склада',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Настройки доставки',
                'verbose_name_plural': 'Настройки доставки',
            },
        ),
        migrations.RunPython(create_default_delivery_settings, remove_delivery_settings),
    ]

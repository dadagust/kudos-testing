from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('orders', '0002_order_services_total_amount'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('paid', 'Оплачен'),
                    ('unpaid', 'Не оплачен'),
                    ('partially_paid', 'Частично оплачен'),
                ],
                default='unpaid',
                max_length=32,
                verbose_name='Статус оплаты',
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='order',
            name='logistics_state',
            field=models.CharField(
                blank=True,
                choices=[
                    ('handover_to_picking', 'Передан на сборку'),
                    ('picked', 'Собран'),
                    ('shipped', 'Отгружен'),
                ],
                max_length=32,
                null=True,
                verbose_name='Состояние логистики',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='shipment_date',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name='Дата отгрузки',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='warehouse_received_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name='Принят на склад в',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='warehouse_received_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='received_orders',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Принят на складе пользователем',
            ),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(fields=['payment_status'], name='orders_order_payment_status_idx'),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(fields=['logistics_state'], name='orders_order_logistics_state_idx'),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(fields=['shipment_date'], name='orders_order_shipment_date_idx'),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(
                fields=['logistics_state', 'warehouse_received_at'],
                name='orders_order_logistics_received_idx',
            ),
        ),
    ]

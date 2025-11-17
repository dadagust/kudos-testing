from __future__ import annotations

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_order_comment_for_waybill'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='delivery_total_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=12,
                verbose_name='Стоимость доставки',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='dismantle_total_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=12,
                verbose_name='Стоимость демонтажа',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='installation_total_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=12,
                verbose_name='Стоимость монтажа',
            ),
        ),
    ]

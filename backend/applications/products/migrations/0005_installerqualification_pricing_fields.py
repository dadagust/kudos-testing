from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_alter_product_setup_install_minutes_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='installerqualification',
            name='hour_price_rub',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=12,
                validators=[MinValueValidator(Decimal('0'))],
                verbose_name='Почасовая ставка, руб',
            ),
        ),
        migrations.AddField(
            model_name='installerqualification',
            name='minimal_price_rub',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=12,
                validators=[MinValueValidator(Decimal('0'))],
                verbose_name='Минимальная стоимость работ, руб',
            ),
        ),
    ]

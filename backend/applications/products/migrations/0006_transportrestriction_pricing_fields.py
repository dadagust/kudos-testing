from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0005_installerqualification_pricing_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='transportrestriction',
            name='capacity_volume_cm3',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Максимальный объём груза, который помещается в один транспорт.',
                null=True,
                validators=[MinValueValidator(1)],
                verbose_name='Вмещаемый объём, см³',
            ),
        ),
        migrations.AddField(
            model_name='transportrestriction',
            name='cost_per_km_rub',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Стоимость одного километра пути для транспорта данного типа.',
                max_digits=12,
                null=True,
                validators=[MinValueValidator(Decimal('0.00'))],
                verbose_name='Стоимость за км, руб',
            ),
        ),
        migrations.AddField(
            model_name='transportrestriction',
            name='cost_per_transport_rub',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Фиксированная стоимость подачи единицы транспорта.',
                max_digits=12,
                null=True,
                validators=[MinValueValidator(Decimal('0.00'))],
                verbose_name='Стоимость за транспорт, руб',
            ),
        ),
    ]

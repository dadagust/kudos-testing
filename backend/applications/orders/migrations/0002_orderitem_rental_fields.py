from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='rental_days',
            field=models.PositiveIntegerField(default=1, verbose_name='Дней аренды'),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='rental_mode',
            field=models.CharField(
                choices=[('standard', 'Стандартный'), ('special', 'Особый')],
                default='standard',
                max_length=32,
                verbose_name='Режим аренды',
            ),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='rental_tiers_snapshot',
            field=models.JSONField(
                blank=True,
                default=list,
                verbose_name='Снимок тарифов аренды',
            ),
        ),
    ]

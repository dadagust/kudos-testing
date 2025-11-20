from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0006_deliverysettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='delivery_pricing_details',
            field=models.JSONField(
                blank=True,
                default=dict,
                verbose_name='Детали расчёта доставки',
            ),
        ),
    ]

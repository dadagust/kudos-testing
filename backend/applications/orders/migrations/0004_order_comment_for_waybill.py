"""Add comment_for_waybill field to orders."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_orderdriver_remove_order_delivery_address_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='comment_for_waybill',
            field=models.TextField(blank=True, verbose_name='Комментарий для накладной'),
        ),
    ]

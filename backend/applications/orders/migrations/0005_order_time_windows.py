from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_order_address_structured'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='mount_datetime_from',
            field=models.TimeField(
                blank=True,
                null=True,
                verbose_name='Время начала монтажа',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='mount_datetime_to',
            field=models.TimeField(
                blank=True,
                null=True,
                verbose_name='Время окончания монтажа',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='dismount_datetime_from',
            field=models.TimeField(
                blank=True,
                null=True,
                verbose_name='Время начала демонтажа',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='dismount_datetime_to',
            field=models.TimeField(
                blank=True,
                null=True,
                verbose_name='Время окончания демонтажа',
            ),
        ),
    ]

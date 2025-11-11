from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_order_time_windows'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderDriver',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
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
                    'full_name',
                    models.CharField(max_length=255, verbose_name='ФИО водителя'),
                ),
                (
                    'phone',
                    models.CharField(blank=True, max_length=32, verbose_name='Телефон'),
                ),
                (
                    'phone_normalized',
                    models.CharField(
                        blank=True,
                        max_length=32,
                        verbose_name='Телефон (нормализованный)',
                    ),
                ),
                (
                    'order',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='driver',
                        to='orders.order',
                        verbose_name='Заказ',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Водитель заказа',
                'verbose_name_plural': 'Водители заказов',
                'ordering': ['-created'],
            },
        ),
    ]

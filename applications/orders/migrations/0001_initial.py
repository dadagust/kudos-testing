from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Order',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('modified', models.DateTimeField(auto_now=True, verbose_name='Обновлено')),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('new', 'Новый'),
                            ('reserved', 'В резерве'),
                            ('in_rent', 'В аренде'),
                            ('in_progress', 'В работе'),
                            ('archived', 'Архив'),
                            ('cancelled', 'Отказ'),
                        ],
                        default='new',
                        max_length=32,
                        verbose_name='Статус',
                    ),
                ),
                (
                    'total_amount',
                    models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name='Сумма заказа'),
                ),
                ('installation_date', models.DateField(verbose_name='Дата монтажа')),
                ('dismantle_date', models.DateField(verbose_name='Дата демонтажа')),
                (
                    'delivery_option',
                    models.CharField(
                        choices=[('delivery', 'Доставка'), ('pickup', 'Самовывоз')],
                        default='delivery',
                        max_length=16,
                        verbose_name='Способ получения',
                    ),
                ),
                ('delivery_address', models.CharField(blank=True, max_length=255, verbose_name='Адрес доставки')),
                ('comment', models.TextField(blank=True, verbose_name='Комментарий')),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='created_orders',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'customer',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='orders',
                        to='customers.customer',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Заказ',
                'verbose_name_plural': 'Заказы',
                'ordering': ('-created',),
            },
        ),
        migrations.CreateModel(
            name='OrderItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('modified', models.DateTimeField(auto_now=True, verbose_name='Обновлено')),
                (
                    'product',
                    models.CharField(
                        choices=[('product_1', 'Товар 1'), ('product_2', 'Товар 2')],
                        max_length=32,
                        verbose_name='Товар',
                    ),
                ),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Количество')),
                (
                    'order',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='items',
                        to='orders.order',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Позиция заказа',
                'verbose_name_plural': 'Позиции заказа',
            },
        ),
    ]

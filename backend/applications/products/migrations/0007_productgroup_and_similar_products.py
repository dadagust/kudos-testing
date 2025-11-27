import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0006_transportrestriction_pricing_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='similar_products',
            field=models.ManyToManyField(
                blank=True,
                to='products.product',
                verbose_name='Похожие товары',
            ),
        ),
        migrations.CreateModel(
            name='ProductGroup',
            fields=[
                ('created', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('modified', models.DateTimeField(auto_now=True, verbose_name='Дата изменения')),
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    'name',
                    models.CharField(max_length=255, unique=True, verbose_name='Название'),
                ),
                (
                    'products',
                    models.ManyToManyField(
                        blank=True,
                        related_name='groups',
                        to='products.product',
                        verbose_name='Товары',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Группа товаров',
                'verbose_name_plural': 'Группы товаров',
                'ordering': ['name'],
            },
        ),
    ]

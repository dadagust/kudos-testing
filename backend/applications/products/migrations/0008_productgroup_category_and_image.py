from django.db import migrations, models
import django.db.models.deletion

import applications.core.models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_productgroup_and_similar_products'),
    ]

    operations = [
        migrations.AddField(
            model_name='productgroup',
            name='category',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='product_groups',
                to='products.category',
                verbose_name='Категория',
            ),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=applications.core.models.PathAndRename('products/product_group_photo/file'),
                verbose_name='Изображение',
            ),
        ),
    ]

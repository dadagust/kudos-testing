from django.db import migrations, models

import applications.core.models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0008_productgroup_category_and_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=applications.core.models.PathAndRename('products/category_photo/image'),
                verbose_name='Изображение',
            ),
        ),
    ]

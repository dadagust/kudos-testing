from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='complementary_products',
            field=models.ManyToManyField(
                blank=True,
                related_name='complemented_by',
                to='products.product',
                verbose_name='Дополняющие изделия',
                symmetrical=False,
            ),
        ),
    ]

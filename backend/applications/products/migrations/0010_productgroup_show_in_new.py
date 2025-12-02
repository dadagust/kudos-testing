from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0009_category_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='productgroup',
            name='show_in_new',
            field=models.BooleanField(default=False, verbose_name='Показывать в новинках'),
        ),
    ]

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0002_alter_productimage_file'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='product',
            name='occupancy_insurance_reserve_percent',
        ),
    ]

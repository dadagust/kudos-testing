from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0002_remove_customer_tags'),
    ]

    operations = [
        migrations.RenameField(
            model_name='company',
            old_name='created_at',
            new_name='created',
        ),
        migrations.RenameField(
            model_name='company',
            old_name='updated_at',
            new_name='modified',
        ),
        migrations.AddField(
            model_name='company',
            name='status',
            field=models.CharField(
                choices=[('draft', 'Черновик'), ('published', 'Опубликовано')],
                default='published',
                max_length=50,
                verbose_name='Статус',
            ),
        ),
        migrations.RenameField(
            model_name='contact',
            old_name='created_at',
            new_name='created',
        ),
        migrations.RenameField(
            model_name='contact',
            old_name='updated_at',
            new_name='modified',
        ),
        migrations.AddField(
            model_name='contact',
            name='status',
            field=models.CharField(
                choices=[('draft', 'Черновик'), ('published', 'Опубликовано')],
                default='published',
                max_length=50,
                verbose_name='Статус',
            ),
        ),
        migrations.RenameField(
            model_name='customer',
            old_name='created_at',
            new_name='created',
        ),
        migrations.RenameField(
            model_name='customer',
            old_name='updated_at',
            new_name='modified',
        ),
        migrations.AddField(
            model_name='customer',
            name='status',
            field=models.CharField(
                choices=[('draft', 'Черновик'), ('published', 'Опубликовано')],
                default='published',
                max_length=50,
                verbose_name='Статус',
            ),
        ),
    ]

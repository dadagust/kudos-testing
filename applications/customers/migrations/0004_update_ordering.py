from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0003_replace_timestampedmodel'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='company',
            options={
                'ordering': ['-created'],
                'verbose_name': 'Компания',
                'verbose_name_plural': 'Компании',
            },
        ),
        migrations.AlterModelOptions(
            name='contact',
            options={
                'ordering': ['-created'],
                'verbose_name': 'Контакт',
                'verbose_name_plural': 'Контакты',
            },
        ),
        migrations.AlterModelOptions(
            name='customer',
            options={
                'ordering': ['-created'],
                'verbose_name': 'Клиент',
                'verbose_name_plural': 'Клиенты',
            },
        ),
    ]

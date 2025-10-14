from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0001_initial'),
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
        migrations.AlterModelOptions(
            name='company',
            options={
                'abstract': False,
                'indexes': [
                    models.Index(fields=['name'], name='company_name_idx'),
                    models.Index(fields=['inn'], name='company_inn_idx'),
                ],
                'ordering': ('-created',),
                'verbose_name': 'Компания',
                'verbose_name_plural': 'Компании',
            },
        ),
        migrations.AlterModelOptions(
            name='contact',
            options={
                'abstract': False,
                'ordering': ('-created',),
                'verbose_name': 'Контакт',
                'verbose_name_plural': 'Контакты',
            },
        ),
        migrations.AlterModelOptions(
            name='customer',
            options={
                'abstract': False,
                'ordering': ('-created',),
                'verbose_name': 'Клиент',
                'verbose_name_plural': 'Клиенты',
            },
        ),
    ]

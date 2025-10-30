from __future__ import annotations

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0002_alter_productimage_file'),
    ]

    operations = [
        migrations.CreateModel(
            name='Color',
            fields=[
                ('created', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('modified', models.DateTimeField(auto_now=True, verbose_name='Дата изменения')),
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ('value', models.CharField(max_length=32, unique=True, verbose_name='Значение')),
                ('label', models.CharField(max_length=255, verbose_name='Название')),
            ],
            options={
                'verbose_name': 'Цвет',
                'verbose_name_plural': 'Цвета',
                'ordering': ['label'],
            },
        ),
        migrations.CreateModel(
            name='TransportRestriction',
            fields=[
                ('created', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('modified', models.DateTimeField(auto_now=True, verbose_name='Дата изменения')),
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ('value', models.CharField(max_length=32, unique=True, verbose_name='Значение')),
                ('label', models.CharField(max_length=255, verbose_name='Название')),
            ],
            options={
                'verbose_name': 'Ограничение по транспорту',
                'verbose_name_plural': 'Ограничения по транспорту',
                'ordering': ['label'],
            },
        ),
        migrations.AlterField(
            model_name='product',
            name='color',
            field=models.CharField(
                blank=True,
                max_length=32,
                null=True,
                verbose_name='Цвет',
            ),
        ),
        migrations.AlterField(
            model_name='product',
            name='delivery_transport_restriction',
            field=models.CharField(
                blank=True,
                max_length=32,
                null=True,
                verbose_name='Ограничение по транспорту',
            ),
        ),
    ]

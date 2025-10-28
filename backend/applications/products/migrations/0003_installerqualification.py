from __future__ import annotations

import uuid
from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


def populate_installer_qualifications(apps, schema_editor):
    InstallerQualification = apps.get_model('products', 'InstallerQualification')
    Product = apps.get_model('products', 'Product')
    db_alias = schema_editor.connection.alias

    default_definitions = [
        ('any', 'Любой'),
        ('worker_with_steam_generator', 'Только «Работник с парогенератором»'),
    ]

    code_to_pk: dict[str, uuid.UUID] = {}
    for _, name in default_definitions:
        obj, _ = InstallerQualification.objects.using(db_alias).get_or_create(
            name=name,
            defaults={'price_rub': Decimal('0.00')},
        )
        code_to_pk[name] = obj.pk

    legacy_values = (
        Product.objects.using(db_alias)
        .exclude(setup_installer_qualification_legacy__isnull=True)
        .exclude(setup_installer_qualification_legacy__exact='')
    )

    for product in legacy_values.iterator():
        legacy_value = product.setup_installer_qualification_legacy
        if not legacy_value:
            continue
        target_pk: uuid.UUID | None = None
        for code, name in default_definitions:
            if legacy_value == code:
                target_pk = code_to_pk.get(name)
                break
        if target_pk is None:
            for name, pk in code_to_pk.items():
                if legacy_value == name:
                    target_pk = pk
                    break
        if target_pk is None:
            continue
        product.setup_installer_qualification_id = target_pk
        product.save(update_fields=['setup_installer_qualification'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0002_update_product_seo_fields'),
    ]

    operations = [
        migrations.RenameField(
            model_name='product',
            old_name='setup_installer_qualification',
            new_name='setup_installer_qualification_legacy',
        ),
        migrations.CreateModel(
            name='InstallerQualification',
            fields=[
                ('created', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('modified', models.DateTimeField(auto_now=True, verbose_name='Дата изменения')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255, unique=True, verbose_name='Название')),
                (
                    'price_rub',
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal('0.00'),
                        max_digits=12,
                        validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                        verbose_name='Стоимость, руб',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Квалификация монтажников',
                'verbose_name_plural': 'Квалификации монтажников',
                'ordering': ['name'],
                'abstract': False,
            },
        ),
        migrations.AddField(
            model_name='product',
            name='setup_installer_qualification',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='products',
                to='products.installerqualification',
                verbose_name='Квалификация сетапёров',
            ),
        ),
        migrations.RunPython(populate_installer_qualifications, noop_reverse),
        migrations.RemoveField(
            model_name='product',
            name='setup_installer_qualification_legacy',
        ),
    ]

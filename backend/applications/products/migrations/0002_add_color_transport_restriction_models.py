"""Create lookup tables for product enums and link existing products."""

from __future__ import annotations

import uuid

import django.db.models.deletion
from django.db import migrations, models

COLORS: tuple[tuple[str, str], ...] = (
    ("white", "Белый"),
    ("gray", "Серый"),
    ("black", "Чёрный"),
    ("red", "Красный"),
    ("orange", "Оранжевый"),
    ("brown", "Коричневый"),
    ("yellow", "Жёлтый"),
    ("green", "Зелёный"),
    ("turquoise", "Бирюзовый"),
    ("blue", "Синий"),
    ("violet", "Фиолетовый"),
)

TRANSPORT_RESTRICTIONS: tuple[tuple[str, str], ...] = (
    ("any", "Любой"),
    ("truck_only", "Только грузовой"),
    ("heavy_only", "Только большегрузный"),
    ("heavy16_only", "Только «Большегрузный 16+»"),
    ("special2_only", "Только «Особый 2»"),
)


def seed_product_enums(apps, schema_editor) -> None:
    Color = apps.get_model("products", "Color")
    TransportRestriction = apps.get_model("products", "TransportRestriction")

    for value, label in COLORS:
        Color.objects.update_or_create(
            value=value,
            defaults={"label": label},
        )

    for value, label in TRANSPORT_RESTRICTIONS:
        TransportRestriction.objects.update_or_create(
            value=value,
            defaults={"label": label},
        )


def unseed_product_enums(apps, schema_editor) -> None:
    Color = apps.get_model("products", "Color")
    TransportRestriction = apps.get_model("products", "TransportRestriction")

    Color.objects.filter(value__in=[value for value, _ in COLORS]).delete()
    TransportRestriction.objects.filter(value__in=[value for value, _ in TRANSPORT_RESTRICTIONS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Color",
            fields=[
                (
                    "created",
                    models.DateTimeField(auto_now_add=True, verbose_name="Дата создания"),
                ),
                (
                    "modified",
                    models.DateTimeField(auto_now=True, verbose_name="Дата изменения"),
                ),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("value", models.CharField(max_length=32, unique=True, verbose_name="Значение")),
                ("label", models.CharField(max_length=255, verbose_name="Название")),
            ],
            options={
                "verbose_name": "Цвет",
                "verbose_name_plural": "Цвета",
                "ordering": ["label"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="TransportRestriction",
            fields=[
                (
                    "created",
                    models.DateTimeField(auto_now_add=True, verbose_name="Дата создания"),
                ),
                (
                    "modified",
                    models.DateTimeField(auto_now=True, verbose_name="Дата изменения"),
                ),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("value", models.CharField(max_length=32, unique=True, verbose_name="Значение")),
                ("label", models.CharField(max_length=255, verbose_name="Название")),
            ],
            options={
                "verbose_name": "Ограничение по транспорту",
                "verbose_name_plural": "Ограничения по транспорту",
                "ordering": ["label"],
                "abstract": False,
            },
        ),
        migrations.RunPython(seed_product_enums, reverse_code=unseed_product_enums),
        migrations.AlterField(
            model_name="product",
            name="color",
            field=models.ForeignKey(
                blank=True,
                db_column="color",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="products",
                to="products.color",
                to_field="value",
                verbose_name="Цвет",
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="delivery_transport_restriction",
            field=models.ForeignKey(
                blank=True,
                db_column="delivery_transport_restriction",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="products",
                to="products.transportrestriction",
                to_field="value",
                verbose_name="Ограничение по транспорту",
            ),
        ),
    ]

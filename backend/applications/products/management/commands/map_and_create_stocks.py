from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from applications.products.management.commands._slug import make_slug
from applications.products.models import (
    Category,
    Color,
    DimensionShape,
    InstallerQualification,
    Product,
    TransportRestriction,
)


@dataclass(frozen=True)
class ShapeSpec:
    dimension_shape: str
    fields: tuple[str, ...]


SHAPE_MAPPING: dict[str, ShapeSpec] = {
    'круг': ShapeSpec(DimensionShape.CIRCLE_DIAMETER, ('circle_diameter_cm',)),
    'линия': ShapeSpec(DimensionShape.LINE_LENGTH, ('line_length_cm',)),
    'прямоугольник': ShapeSpec(
        DimensionShape.RECTANGLE_LENGTH_WIDTH,
        ('rectangle_length_cm', 'rectangle_width_cm'),
    ),
    'цилиндр': ShapeSpec(
        DimensionShape.CYLINDER_DIAMETER_HEIGHT,
        ('cylinder_diameter_cm', 'cylinder_height_cm'),
    ),
    'параллелепипед': ShapeSpec(
        DimensionShape.BOX_HEIGHT_WIDTH_DEPTH,
        ('box_height_cm', 'box_width_cm', 'box_depth_cm'),
    ),
}


def to_decimal(value: float | int | str | None) -> Decimal | None:
    if value is None:
        return None
    decimal = Decimal(str(value))
    return decimal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def to_positive_int(value: float | int | str | None) -> int | None:
    if value is None:
        return None
    decimal = Decimal(str(value))
    if decimal == 0:
        return None
    scaled = decimal * Decimal('1000000')
    return int(scaled.to_integral_value(rounding=ROUND_HALF_UP))


class Command(BaseCommand):
    help = 'Импортирует товары и связанные сущности из articleFull.json.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--articles',
            default='articlesFull.json',
            help='Путь к файлу articleFull.json.',
        )
        parser.add_argument(
            '--categories',
            default='categories.json',
            help='Путь к файлу categories.json.',
        )

    def _load_json(self, path: Path) -> list[dict]:
        with path.open('r', encoding='utf-8') as fp:
            return json.load(fp)

    def handle(self, *args, **options):
        articles_path = Path(options['articles']).expanduser().resolve()
        stocks_path = Path('stocks.json').expanduser().resolve()

        if not articles_path.exists():
            raise CommandError(f'Файл с товарами не найден: {articles_path}')


        articles_data = self._load_json(articles_path)
        stocks_data = self._load_json(stocks_path)

        for stock in stocks_data:
            article_id = stock['article_id']
            item = next((x for x in articles_data if x.get("id") == article_id), None)
            if item:
                product = Product.objects.get(name=item["name"])
                product.stock_qty = stock['quantity']
                product.available_stock_qty = stock['quantity']
                product.save()
                print(f'saved: {product.name} with stock: {product.stock_qty}')



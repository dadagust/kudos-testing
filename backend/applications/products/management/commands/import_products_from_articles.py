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

    def handle(self, *args, **options):
        articles_path = Path(options['articles']).expanduser().resolve()
        categories_path = Path(options['categories']).expanduser().resolve()

        if not articles_path.exists():
            raise CommandError(f'Файл с товарами не найден: {articles_path}')
        if not categories_path.exists():
            raise CommandError(f'Файл с категориями не найден: {categories_path}')

        articles_data = self._load_json(articles_path)
        categories_data = self._load_json(categories_path)
        categories = {int(item['id']): item['name'] for item in categories_data}

        default_worker = self._get_worker(price_zero=True)
        paid_worker = self._get_worker(price_zero=False)

        created, updated = 0, 0
        cache: dict[str, Product] = {}

        with transaction.atomic():
            for raw_article in articles_data:
                product, was_created = self._ensure_product(
                    raw_article,
                    categories,
                    cache,
                    default_worker,
                    paid_worker,
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Готово. Создано товаров: {created}, обновлено: {updated}.',
            )
        )

    def _load_json(self, path: Path) -> list[dict]:
        with path.open('r', encoding='utf-8') as fp:
            return json.load(fp)

    def _get_worker(self, *, price_zero: bool) -> InstallerQualification | None:
        queryset = InstallerQualification.objects.all()
        if price_zero:
            queryset = queryset.filter(price_rub=Decimal('0.00'))
        else:
            queryset = queryset.filter(price_rub__gt=Decimal('0.00')).order_by('price_rub')
        return queryset.first()

    def _ensure_product(
        self,
        article: dict,
        categories: dict[int, str],
        cache: dict[str, Product],
        default_worker: InstallerQualification | None,
        paid_worker: InstallerQualification | None,
    ) -> tuple[Product, bool]:
        name = article['name'].strip()
        if not name:
            raise CommandError('Не удалось создать товар без названия.')

        if name in cache:
            return cache[name], False

        category = self._ensure_category(article['category_id'], categories)

        product, was_created = Product.objects.get_or_create(
            name=name,
            defaults={'category': category},
        )

        if not was_created and product.category_id != category.id:
            product.category = category

        self._apply_product_data(
            product,
            article,
            default_worker,
            paid_worker,
        )
        product.save()

        cache[name] = product

        children = article.get('children') or []
        complementary_products: list[Product] = []
        for child in children:
            child_product, _ = self._ensure_product(
                child,
                categories,
                cache,
                default_worker,
                paid_worker,
            )
            complementary_products.append(child_product)

        if complementary_products:
            product.complementary_products.set(complementary_products)
        else:
            product.complementary_products.clear()

        return product, was_created

    def _ensure_category(
        self, category_id: int, categories: dict[int, str]
    ) -> Category:
        try:
            category_name = categories[int(category_id)]
        except KeyError as exc:  # pragma: no cover - защитный код
            raise CommandError(f'Не найдена категория с id={category_id}') from exc

        slug = make_slug(category_name)
        category, _ = Category.objects.get_or_create(
            slug=slug,
            defaults={'name': category_name},
        )
        if category.name != category_name:
            category.name = category_name
            category.save(update_fields=['name'])
        return category

    def _apply_product_data(
        self,
        product: Product,
        article: dict,
        default_worker: InstallerQualification | None,
        paid_worker: InstallerQualification | None,
    ) -> None:
        product.description = article.get('key_feature_description') or ''
        product.price_rub = to_decimal(article.get('price')) or Decimal('0.00')
        product.loss_compensation_rub = to_decimal(article.get('loss_price'))
        product.color = self._ensure_color(article.get('color'))

        self._assign_dimensions(product, article)

        product.occupancy_cleaning_days = article.get('recovery_duration') or None
        product.delivery_volume_cm3 = to_positive_int(article.get('gross_volume'))
        product.delivery_weight_kg = to_decimal(article.get('gross_mass'))

        product.setup_install_minutes = to_decimal(article.get('setup_duration'))
        product.setup_uninstall_minutes = to_decimal(article.get('teardown_duration'))

        worker_key = article.get('worker')
        if worker_key:
            if paid_worker is None:
                raise CommandError(
                    'Не найдена квалификация монтажников с оплатой, хотя товар требует работников.'
                )
            product.setup_installer_qualification = paid_worker
        else:
            if default_worker is None:
                raise CommandError(
                    'Не найдена базовая квалификация монтажников с нулевой стоимостью.'
                )
            product.setup_installer_qualification = default_worker

        product.setup_min_installers = article.get('worker_count') or None

        is_delivery_mandatory = bool(article.get('is_delivery_mandatory'))
        product.delivery_self_pickup_allowed = not is_delivery_mandatory

        is_arrangement_mandatory = bool(article.get('is_arrangement_mandatory'))
        product.setup_self_setup_allowed = not is_arrangement_mandatory

        product.delivery_transport_restriction = self._ensure_transport(
            article.get('vehicle')
        )

        product.visibility_show_on_site = bool(article.get('is_shown_in_catalog'))
        product.visibility_show_in_new = bool(article.get('show_in_new'))
        product.visibility_category_cover_on_home = bool(article.get('is_category_cover'))

        product.seo_meta_title = article.get('seo_title') or ''
        product.seo_meta_description = article.get('seo_description') or ''

    def _assign_dimensions(self, product: Product, article: dict) -> None:
        raw_shape = article.get('shape')
        if not raw_shape:
            raise CommandError(f"У товара '{product.name}' не указана форма.")

        try:
            shape_spec = SHAPE_MAPPING[raw_shape.lower()]
        except KeyError as exc:
            raise CommandError(
                f"Неизвестная форма '{raw_shape}' для товара '{product.name}'."
            ) from exc

        product.dimensions_shape = shape_spec.dimension_shape

        self._clear_dimension_fields(product)

        sizes: Iterable = article.get('sizes') or []
        for field_name, value in zip(shape_spec.fields, sizes):
            setattr(product, field_name, to_decimal(value))

    def _clear_dimension_fields(self, product: Product) -> None:
        product.circle_diameter_cm = None
        product.line_length_cm = None
        product.rectangle_length_cm = None
        product.rectangle_width_cm = None
        product.cylinder_diameter_cm = None
        product.cylinder_height_cm = None
        product.box_height_cm = None
        product.box_width_cm = None
        product.box_depth_cm = None

    def _ensure_color(self, value: str | None) -> Color | None:
        if not value:
            return None

        label = value.replace('_', ' ').title()
        color, _ = Color.objects.get_or_create(
            value=value,
            defaults={'label': label},
        )
        return color

    def _ensure_transport(self, value: str | None) -> TransportRestriction | None:
        if not value:
            return None

        label = value.replace('_', ' ').title()
        restriction, _ = TransportRestriction.objects.get_or_create(
            value=value,
            defaults={'label': label},
        )
        return restriction

"""Management command for importing product catalog entities from JSON payloads."""

from __future__ import annotations

import json
from collections.abc import Iterable
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    """Create or update product catalog entities from legacy JSON exports."""

    help = (
        'Импортирует товары из articleFull.json с привязками к категориям из '
        'categories.json. Для каждого товара создаются связанные сущности '
        'цветов и ограничений транспорта при отсутствии таковых.'
    )

    PRODUCT_MODEL_NAME = 'Product'
    CATEGORY_MODEL_NAME = 'Category'
    COLOR_MODEL_NAME = 'Color'
    TRANSPORT_MODEL_NAME = 'TransportRestriction'
    QUALIFICATION_MODEL_NAME = 'InstallerQualification'

    def add_arguments(self, parser) -> None:  # pragma: no cover - argparse plumbing
        parser.add_argument(
            '--articles-path',
            dest='articles_path',
            default='articleFull.json',
            help='Путь к файлу articleFull.json (по умолчанию ./articleFull.json).',
        )
        parser.add_argument(
            '--categories-path',
            dest='categories_path',
            default='categories.json',
            help='Путь к файлу categories.json (по умолчанию ./categories.json).',
        )

    def handle(self, *args, **options):  # pragma: no cover - integration entry point
        articles_path = Path(options['articles_path']).expanduser().resolve()
        categories_path = Path(options['categories_path']).expanduser().resolve()

        if not articles_path.exists():
            raise CommandError(f'Файл с товарами не найден: {articles_path}')
        if not categories_path.exists():
            raise CommandError(f'Файл с категориями не найден: {categories_path}')

        importer = ProductImporter(
            stdout=self.stdout,
            style=self.style,
        )

        with categories_path.open('r', encoding='utf-8') as stream:
            categories_payload = json.load(stream)

        with articles_path.open('r', encoding='utf-8') as stream:
            articles_payload = json.load(stream)

        stats = importer.run(categories_payload, articles_payload)

        self.stdout.write(self.style.SUCCESS('Импорт завершен.'))
        self.stdout.write(
            f"Создано товаров: {stats['created_products']}, "
            f"пропущено (уже существовали): {stats['existing_products']}"
        )
        self.stdout.write(
            f"Создано новых категорий: {stats['created_categories']}, "
            f"новых цветов: {stats['created_colors']}, "
            f"ограничений по транспорту: {stats['created_transport_restrictions']}"
        )


class ProductImporter:
    """High level orchestrator for transforming the legacy JSON payload into models."""

    def __init__(self, *, stdout, style) -> None:
        self.stdout = stdout
        self.style = style
        self.product_model = self._get_unique_model(Command.PRODUCT_MODEL_NAME)
        self.category_model = self._get_unique_model(Command.CATEGORY_MODEL_NAME)
        self.color_model = self._get_unique_model(Command.COLOR_MODEL_NAME)
        self.transport_model = self._get_unique_model(Command.TRANSPORT_MODEL_NAME)
        self.qualification_model = self._get_unique_model(Command.QUALIFICATION_MODEL_NAME)
        self.product_fields = {field.name for field in self.product_model._meta.get_fields()}
        self.category_fields = {field.name for field in self.category_model._meta.get_fields()}
        self.color_fields = {field.name for field in self.color_model._meta.get_fields()}
        self.transport_fields = {field.name for field in self.transport_model._meta.get_fields()}
        self.qualifications = self._load_qualifications()
        self.dimension_shape_enum = getattr(self.product_model, 'DimensionShape', None)
        self.stats = {
            'created_products': 0,
            'existing_products': 0,
            'created_categories': 0,
            'created_colors': 0,
            'created_transport_restrictions': 0,
        }
        self._product_cache: dict[str, Any] = {}
        self._category_cache: dict[str, Any] = {}

    def run(self, categories_payload: Any, articles_payload: Any) -> dict[str, int]:
        categories_map = self._prepare_categories(categories_payload)
        products_payload = self._extract_products(articles_payload)

        for product_payload in products_payload:
            self._process_product(product_payload, categories_map)

        return self.stats

    def _process_product(self, payload: dict[str, Any], categories_map: dict[str, str]):
        if not isinstance(payload, dict):
            return None

        name = (payload.get('name') or '').strip()
        if not name:
            self.stdout.write(self.style.WARNING('Пропущена запись товара без названия.'))
            return None

        product = self._get_existing_product(name)
        if product is None:
            product = self._create_product(payload, categories_map)
            if product is None:
                return None
            self.stats['created_products'] += 1
            self._product_cache[name.lower()] = product
        else:
            self.stats['existing_products'] += 1

        complementary_instances = []
        for child_payload in payload.get('children') or []:
            child_product = self._process_product(child_payload, categories_map)
            if child_product is not None:
                complementary_instances.append(child_product)

        if complementary_instances and hasattr(product, 'complementary_products'):
            product.complementary_products.add(*complementary_instances)

        return product

    def _create_product(self, payload: dict[str, Any], categories_map: dict[str, str]):
        category = self._resolve_category(payload, categories_map)
        if category is None:
            self.stdout.write(
                self.style.WARNING(f"Категория для товара '{payload.get('name')}' не найдена. Пропуск.")
            )
            return None

        fields: dict[str, Any] = {}

        if 'category' in self.product_fields:
            fields['category'] = category

        self._assign_if_present(fields, 'name', payload.get('name'))
        self._assign_if_present(
            fields,
            'key_feature_description',
            payload.get('description'),
        )

        self._assign_decimal(fields, 'price', payload.get('price_rub'))

        shape_value = self._coerce_shape(payload.get('dimensions_shape'))
        if shape_value is not None and 'shape' in self.product_fields:
            fields['shape'] = shape_value

        self._assign_numeric_sizes(fields, payload.get('sizes'), shape_value)

        self._assign_if_present(
            fields,
            'recovery_duration',
            payload.get('occupancy_cleaning_days'),
        )
        self._assign_if_present(fields, 'gross_volume', payload.get('delivery_volume_cm3'))
        self._assign_if_present(fields, 'gross_mass', payload.get('delivery_weight_kg'))

        self._assign_decimal(
            fields, 'setup_duration', payload.get('setup_install_minutes'), quantize=True
        )
        self._assign_decimal(
            fields, 'teardown_duration', payload.get('setup_uninstall_minutes'), quantize=True
        )

        delivery_pickup_allowed = payload.get('delivery_self_pickup_allowed')
        if delivery_pickup_allowed is not None and 'is_delivery_mandatory' in self.product_fields:
            fields['is_delivery_mandatory'] = not bool(delivery_pickup_allowed)

        setup_self_setup_allowed = payload.get('setup_self_setup_allowed')
        if setup_self_setup_allowed is not None and 'is_arrangement_mandatory' in self.product_fields:
            fields['is_arrangement_mandatory'] = not bool(setup_self_setup_allowed)

        color_instance = self._resolve_color(payload)
        if color_instance and 'color' in self.product_fields:
            fields['color'] = color_instance

        self._assign_decimal(fields, 'loss_price', payload.get('loss_compensation_rub'))

        vehicle_instance = self._resolve_transport_restriction(payload.get('delivery_transport_restriction'))
        if vehicle_instance and 'vehicle' in self.product_fields:
            fields['vehicle'] = vehicle_instance

        worker_instance = self._resolve_worker(payload.get('setup_installer_qualification'))
        if worker_instance and 'worker' in self.product_fields:
            fields['worker'] = worker_instance

        self._assign_if_present(fields, 'worker_count', payload.get('setup_min_installers'), cast=int)

        bool_field_mapping = {
            'is_shown_in_catalog': 'visibility_show_on_site',
            'show_in_new': 'visibility_show_in_new',
            'is_category_cover': 'visibility_category_cover_on_home',
        }
        for model_field, payload_key in bool_field_mapping.items():
            if model_field in self.product_fields and payload_key in payload:
                fields[model_field] = bool(payload.get(payload_key))

        seo_mapping = {
            'seo_title': 'seo_meta_title',
            'seo_description': 'seo_meta_description',
        }
        for model_field, payload_key in seo_mapping.items():
            if model_field in self.product_fields:
                value = payload.get(payload_key)
                if value:
                    fields[model_field] = value

        product = self.product_model.objects.create(**fields)

        return product

    def _assign_if_present(
        self,
        fields: dict[str, Any],
        field_name: str,
        value: Any,
        *,
        cast=None,
    ) -> None:
        if field_name not in self.product_fields:
            return
        if value in (None, ''):
            return
        if cast is not None:
            try:
                value = cast(value)
            except (TypeError, ValueError):
                return
        fields[field_name] = value

    def _assign_decimal(
        self,
        fields: dict[str, Any],
        field_name: str,
        value: Any,
        *,
        quantize: bool = False,
    ) -> None:
        if field_name not in self.product_fields:
            return
        if value in (None, ''):
            return
        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return

        field = self.product_model._meta.get_field(field_name)
        if getattr(field, 'decimal_places', 0) > 0:
            quantum = Decimal('1').scaleb(-field.decimal_places)
            decimal_value = decimal_value.quantize(quantum)
        elif quantize:
            decimal_value = decimal_value.quantize(Decimal('0.01'))

        fields[field_name] = decimal_value

    def _assign_numeric_sizes(self, fields: dict[str, Any], sizes_payload: Any, shape_value: str | None):
        if not sizes_payload:
            return

        if isinstance(sizes_payload, dict):
            for key, value in sizes_payload.items():
                if key in self.product_fields:
                    self._assign_decimal(fields, key, value)
                else:
                    fallback_name = self._normalize_size_field_name(key)
                    if fallback_name in self.product_fields:
                        self._assign_decimal(fields, fallback_name, value)
            return

        if isinstance(sizes_payload, Iterable) and not isinstance(sizes_payload, (str, bytes)):
            # Attempt to match iterables (e.g. [width, depth, height]) with existing fields.
            size_values = list(sizes_payload)
            candidate_fields = [
                name
                for name in self.product_fields
                if name.startswith('size_') or name.endswith('_cm') or name.endswith('_mm')
            ]
            if len(size_values) == 1 and shape_value:
                target_field = self._field_for_shape(shape_value)
                if target_field in self.product_fields:
                    self._assign_decimal(fields, target_field, size_values[0])
                return
            for field_name, value in zip(candidate_fields, size_values):
                self._assign_decimal(fields, field_name, value)
            return

        if shape_value:
            target_field = self._field_for_shape(shape_value)
            if target_field in self.product_fields:
                self._assign_decimal(fields, target_field, sizes_payload)

    def _normalize_size_field_name(self, raw_name: str) -> str:
        normalized = ''.join(ch if ch.isalnum() else '_' for ch in raw_name.strip().lower())
        if not normalized:
            return raw_name
        if normalized.endswith('_cm') or normalized.endswith('_mm'):
            return normalized
        return f'{normalized}_cm'

    def _field_for_shape(self, shape_value: str) -> str:
        normalized = shape_value.lower()
        if normalized.endswith('_cm'):
            return normalized
        return f'{normalized}_cm'

    def _coerce_shape(self, raw_value: Any) -> str | None:
        if not raw_value:
            return None
        raw = str(raw_value).strip()
        if not raw:
            return None
        if self.dimension_shape_enum is None:
            return raw

        choice_values = set(getattr(self.dimension_shape_enum, 'values', []))
        if raw in choice_values:
            return raw

        normalized = raw.upper().replace(' ', '_').replace('-', '_')
        enum_members = getattr(self.dimension_shape_enum, '__members__', {})
        if normalized in enum_members:
            return enum_members[normalized].value
        if normalized in choice_values:
            return normalized

        # Try to match by value ignoring case and separators.
        for value in choice_values:
            if normalized == value.upper().replace('-', '_').replace(' ', '_'):
                return value

        self.stdout.write(
            self.style.WARNING(f"Не удалось сопоставить форму '{raw_value}' ни с одним значением DimensionShape."),
        )
        return None

    def _resolve_category(self, payload: dict[str, Any], categories_map: dict[str, str]):
        category_id = payload.get('category_id')
        if not category_id:
            return None
        category_name = categories_map.get(str(category_id)) or categories_map.get(category_id)
        if not category_name:
            return None

        cache_key = category_name.lower()
        if cache_key in self._category_cache:
            return self._category_cache[cache_key]

        category = self.category_model.objects.filter(name=category_name).first()
        if category is None:
            create_kwargs = {}
            if 'name' in self.category_fields:
                create_kwargs['name'] = category_name
            if not create_kwargs:
                return None
            category = self.category_model.objects.create(**create_kwargs)
            self.stats['created_categories'] += 1

        self._category_cache[cache_key] = category
        return category

    def _resolve_color(self, payload: dict[str, Any]):
        color_name = payload.get('color')
        if not color_name:
            return None

        color = self.color_model.objects.filter(name=color_name).first()
        if color:
            return color

        create_kwargs = {}
        if 'name' in self.color_fields:
            create_kwargs['name'] = color_name
        english_name = payload.get('color_en') or payload.get('color_name_en')
        if english_name and 'name_en' in self.color_fields:
            create_kwargs['name_en'] = english_name
        if not create_kwargs:
            return None

        color = self.color_model.objects.create(**create_kwargs)
        self.stats['created_colors'] += 1
        return color

    def _resolve_transport_restriction(self, value: Any):
        if not value:
            return None
        restriction_name = str(value).strip()
        if not restriction_name:
            return None

        restriction = self.transport_model.objects.filter(name=restriction_name).first()
        if restriction:
            return restriction

        create_kwargs = {}
        if 'name' in self.transport_fields:
            create_kwargs['name'] = restriction_name
        if not create_kwargs:
            return None

        restriction = self.transport_model.objects.create(**create_kwargs)
        self.stats['created_transport_restrictions'] += 1
        return restriction

    def _resolve_worker(self, value: Any):
        if not self.qualifications:
            return None
        if value in (None, '', 0):
            return self.qualifications.get('free')
        return self.qualifications.get('paid')

    def _prepare_categories(self, payload: Any) -> dict[str, str]:
        mapping: dict[str, str] = {}

        def walk(nodes: Any):
            if isinstance(nodes, dict):
                node_id = nodes.get('id')
                node_name = nodes.get('name')
                if node_id and node_name:
                    mapping[str(node_id)] = node_name
                children = nodes.get('children') or nodes.get('items')
                if children:
                    walk(children)
            elif isinstance(nodes, list):
                for item in nodes:
                    walk(item)

        walk(payload)
        return mapping

    def _extract_products(self, payload: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []

        def collect(nodes: Any):
            if isinstance(nodes, dict):
                potential_children = None
                if self._looks_like_product(nodes):
                    items.append(nodes)
                    potential_children = nodes.get('children')
                else:
                    for key in ('items', 'products', 'data', 'results'):
                        if key in nodes:
                            potential_children = nodes[key]
                            break
                if potential_children:
                    collect(potential_children)
            elif isinstance(nodes, list):
                for entry in nodes:
                    collect(entry)

        collect(payload)
        return items

    def _looks_like_product(self, payload: dict[str, Any]) -> bool:
        required_keys = {'name', 'price_rub', 'category_id'}
        return required_keys.issubset(payload.keys())

    def _get_existing_product(self, name: str):
        cache_key = name.lower()
        if cache_key in self._product_cache:
            return self._product_cache[cache_key]
        product = self.product_model.objects.filter(name=name).first()
        if product:
            self._product_cache[cache_key] = product
        return product

    def _load_qualifications(self) -> dict[str, Any]:
        qualifications = self.qualification_model.objects.all()
        free = qualifications.filter(price_rub=0).order_by('id').first()
        paid = qualifications.filter(price_rub__gt=0).order_by('price_rub').first()
        return {'free': free, 'paid': paid}

    def _get_unique_model(self, model_name: str):
        matches = []
        for app_config in apps.get_app_configs():
            try:
                model = app_config.get_model(model_name)
            except LookupError:
                continue
            matches.append(model)

        if not matches:
            raise CommandError(f'Модель "{model_name}" не найдена среди зарегистрированных приложений.')
        if len(matches) > 1:
            raise CommandError(
                f'Найдено несколько моделей с именем "{model_name}". Уточните импорт перед запуском.'
            )

        return matches[0]


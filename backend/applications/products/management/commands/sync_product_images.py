from __future__ import annotations

import csv
import json
import logging
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from applications.products.models import Product, ProductImage

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ManifestImage:
    """A single image record from the manifest."""

    product_name: str
    image_url: str
    image_file: str
    is_primary: bool
    order: int


class Command(BaseCommand):
    help = 'Загружает изображения товаров на основе манифеста и обновляет позиции.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--manifest',
            default='images_manifest.json',
            help='Путь к файлу images_manifest.json (поддерживается также CSV).',
        )

    def handle(self, *args, **options):
        manifest_path = Path(options['manifest']).expanduser().resolve()

        if not manifest_path.exists():
            raise CommandError(f'Файл манифеста изображений не найден: {manifest_path}')

        manifest_images = self._load_manifest(manifest_path)
        if not manifest_images:
            raise CommandError('Файл манифеста не содержит записей об изображениях.')

        grouped = self._group_manifest(manifest_images)
        processed_products = 0
        skipped_products = 0
        failed_products = 0

        for product in Product.objects.all().order_by('name'):
            key = self._normalize_name(product.name)
            entries = grouped.get(key)
            if not entries:
                skipped_products += 1
                continue

            try:
                if self._sync_product_images(product, entries):
                    processed_products += 1
                else:
                    failed_products += 1
            except Exception:
                failed_products += 1
                logger.exception('Не удалось обновить изображения для товара "%s"', product.name)

            self.stdout.write(
                self.style.SUCCESS(
                    f'Готово. Обновлено товаров: {processed_products}, '
                    f'пропущено: {skipped_products}, с ошибками: {failed_products}.'
                )
            )

    def _load_manifest(self, path: Path) -> list[ManifestImage]:
        if path.suffix.lower() == '.json':
            raw_items = self._load_json(path)
        elif path.suffix.lower() == '.csv':
            raw_items = self._load_csv(path)
        else:
            raise CommandError('Поддерживаются только файлы JSON или CSV.')

        entries: list[ManifestImage] = []
        for order, item in enumerate(raw_items):
            name = self._normalize_name(str(item.get('product_name', '')))
            image_url = str(item.get('image_url', '')).strip()
            image_file = str(item.get('image_file', '')).strip()
            is_primary = self._to_bool(item.get('is_primary'))

            if not name or not image_url:
                logger.warning('Пропущена запись манифеста без имени или URL: %s', item)
                continue

            entries.append(
                ManifestImage(
                    product_name=name,
                    image_url=image_url,
                    image_file=image_file,
                    is_primary=is_primary,
                    order=order,
                )
            )

        return entries

    def _load_json(self, path: Path) -> list[dict]:
        with path.open('r', encoding='utf-8') as fp:
            data = json.load(fp)
            if isinstance(data, list):
                return [item for item in data if isinstance(item, dict)]
            raise CommandError('Некорректный формат JSON: ожидался список объектов.')

    def _load_csv(self, path: Path) -> list[dict]:
        with path.open('r', encoding='utf-8-sig', newline='') as fp:
            reader = csv.DictReader(fp)
            return [dict(row) for row in reader]

    def _group_manifest(self, entries: Iterable[ManifestImage]) -> dict[str, list[ManifestImage]]:
        grouped: dict[str, list[ManifestImage]] = {}
        for entry in entries:
            grouped.setdefault(entry.product_name, []).append(entry)
        return grouped

    def _sync_product_images(self, product: Product, entries: Iterable[ManifestImage]) -> bool:
        downloaded: list[tuple[ManifestImage, bytes]] = []

        for entry in entries:
            content = self._download(entry.image_url)
            if content is None:
                logger.warning(
                    'Не удалось скачать изображение %s для товара "%s"',
                    entry.image_url,
                    product.name,
                )
                continue
            downloaded.append((entry, content))

        if not downloaded:
            return False

        self._clear_product_images(product)

        primary_entries = [item for item in downloaded if item[0].is_primary]
        non_primary_entries = [item for item in downloaded if not item[0].is_primary]
        ordered = primary_entries + non_primary_entries

        next_position = 1
        primary_assigned = False

        for entry, content in ordered:
            is_primary = entry.is_primary and not primary_assigned
            if is_primary:
                position = 1
                primary_assigned = True
                if next_position == 1:
                    next_position = 2
            else:
                position = next_position
                next_position += 1

            filename = self._build_filename(product, entry)
            image = ProductImage(product=product, position=position)
            image.file.save(filename, ContentFile(content), save=False)
            image.save()

            if entry.is_primary and not is_primary:
                logger.warning(
                    'Для товара "%s" обнаружено несколько первичных изображений. '
                    'Файл %s установлен на позицию %s.',
                    product.name,
                    entry.image_url,
                    position,
                )

        return True

    def _download(self, url: str) -> bytes | None:
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.warning('Ошибка загрузки изображения %s: %s', url, exc)
            return None
        return response.content

    def _clear_product_images(self, product: Product) -> None:
        for image in product.images.all():
            try:
                file_field = image.file
                storage = file_field.storage
                name = file_field.name
                if name:
                    storage.delete(name)
                image.delete()
            except Exception:
                logger.exception('Не удалось удалить предыдущее изображение товара %s', product.pk)

    def _build_filename(self, product: Product, entry: ManifestImage) -> str:
        suffix = Path(entry.image_file.replace('\\', '/')).name or Path(entry.image_url).name
        suffix = suffix or f'{entry.order}.jpg'
        return f'{product.id}_{suffix}'

    def _to_bool(self, value) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {'1', 'true', 'yes', 'y', 'да'}
        if isinstance(value, int | float):
            return bool(value)
        return False

    def _normalize_name(self, value: str) -> str:
        return ' '.join(value.split())

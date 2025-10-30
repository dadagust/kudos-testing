"""Database models for the products domain."""

from __future__ import annotations

import logging
import math
import uuid
from decimal import Decimal
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify

from PIL import Image, ImageOps

from applications.core.models import Date, PathAndRename

from .choices import (
    Color,
    DimensionShape,
    RentalMode,
    ReservationMode,
    TransportRestriction,
)
from .storage import product_image_storage


logger = logging.getLogger(__name__)

try:  # pragma: no cover - Pillow version compatibility
    RESAMPLE_STRATEGY = Image.Resampling.LANCZOS
except AttributeError:  # pragma: no cover - fallback for older Pillow
    RESAMPLE_STRATEGY = Image.LANCZOS


class Category(Date):
    """Hierarchical product category."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('Название', max_length=255)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
    )
    slug = models.SlugField('Слаг', max_length=255, unique=True)

    class Meta(Date.Meta):
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'
        ordering = ['name']

    def __str__(self) -> str:  # pragma: no cover - human readable repr
        return self.name


class InstallerQualification(Date):
    """Qualification required for product installation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('Название', max_length=255, unique=True)
    price_rub = models.DecimalField(
        'Стоимость, руб',
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        default=Decimal('0.00'),
    )

    class Meta(Date.Meta):
        verbose_name = 'Квалификация монтажников'
        verbose_name_plural = 'Квалификации монтажников'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class Product(Date):
    """Product offered for rent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('Название', max_length=255)
    features = models.JSONField('Особенности', default=list, blank=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='products',
        verbose_name='Категория',
    )
    complementary_products = models.ManyToManyField(
        'self',
        verbose_name='Дополняющие изделия',
        symmetrical=False,
        related_name='complemented_by',
        blank=True,
    )
    price_rub = models.DecimalField(
        'Стоимость, руб',
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
    )
    loss_compensation_rub = models.DecimalField(
        'Компенсация за потерю, руб',
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        null=True,
        blank=True,
    )
    color = models.CharField(
        'Цвет',
        max_length=32,
        choices=Color.choices,
        blank=True,
    )

    dimensions_shape = models.CharField(
        'Форма',
        max_length=64,
        choices=DimensionShape.choices,
    )
    circle_diameter_cm = models.DecimalField(
        'Диаметр круга, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    line_length_cm = models.DecimalField(
        'Длина линии, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    rectangle_length_cm = models.DecimalField(
        'Длина прямоугольника, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    rectangle_width_cm = models.DecimalField(
        'Ширина прямоугольника, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    cylinder_diameter_cm = models.DecimalField(
        'Диаметр цилиндра, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    cylinder_height_cm = models.DecimalField(
        'Высота цилиндра, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    box_height_cm = models.DecimalField(
        'Высота параллелепипеда, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    box_width_cm = models.DecimalField(
        'Ширина параллелепипеда, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    box_depth_cm = models.DecimalField(
        'Глубина параллелепипеда, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    occupancy_cleaning_days = models.PositiveIntegerField(
        'Чистка, дни',
        null=True,
        blank=True,
    )
    occupancy_insurance_reserve_percent = models.PositiveIntegerField(
        'Страховой резерв, %',
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True,
        blank=True,
    )

    delivery_volume_cm3 = models.PositiveIntegerField(
        'Объём, см3',
        null=True,
        blank=True,
    )
    delivery_weight_kg = models.DecimalField(
        'Вес, кг',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    delivery_transport_restriction = models.CharField(
        'Ограничение по транспорту',
        max_length=32,
        choices=TransportRestriction.choices,
        blank=True,
    )
    delivery_self_pickup_allowed = models.BooleanField(
        'Самовывоз разрешён',
        default=False,
    )

    setup_install_minutes = models.PositiveIntegerField('Монтаж, мин', null=True, blank=True)
    setup_uninstall_minutes = models.PositiveIntegerField('Демонтаж, мин', null=True, blank=True)
    setup_installer_qualification = models.ForeignKey(
        InstallerQualification,
        on_delete=models.SET_NULL,
        related_name='products',
        verbose_name='Квалификация сетапёров',
        null=True,
        blank=True,
    )
    setup_min_installers = models.PositiveIntegerField(
        'Минимум сетапёров',
        choices=[(value, str(value)) for value in range(1, 5)],
        null=True,
        blank=True,
    )
    setup_self_setup_allowed = models.BooleanField('Самостоятельный сетап', default=False)

    rental_mode = models.CharField(
        'Режим аренды',
        max_length=32,
        choices=RentalMode.choices,
        default=RentalMode.STANDARD,
    )
    rental_special_tiers = models.JSONField(
        'Тарифы аренды (особый)',
        default=list,
        blank=True,
    )

    visibility_reservation_mode = models.CharField(
        'Бронирование',
        max_length=32,
        choices=ReservationMode.choices,
        blank=True,
    )
    visibility_show_on_pifakit = models.BooleanField('На pifakit', default=False)
    visibility_show_on_site = models.BooleanField('На сайте', default=False)
    visibility_show_in_new = models.BooleanField('Новинки', default=False)
    visibility_category_cover_on_home = models.BooleanField('Обложка категории', default=False)

    seo_url_name = models.SlugField('URL имя', max_length=255, unique=True)
    seo_meta_title = models.CharField('Meta title', max_length=255, blank=True)
    seo_meta_description = models.CharField('Meta description', max_length=500, blank=True)

    class Meta(Date.Meta):
        verbose_name = 'Товар'
        verbose_name_plural = 'Товары'
        ordering = ['-created']
        indexes = [
            models.Index(fields=('name',), name='product_name_idx'),
            models.Index(fields=('category',), name='product_category_idx'),
            models.Index(fields=('color',), name='product_color_idx'),
        ]

    @property
    def thumbnail(self) -> ProductImage | None:
        return self.images.order_by('position').first()

    def save(self, *args, **kwargs):
        self.seo_url_name = self._generate_url_name()
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            update_fields = set(update_fields)
            update_fields.add('seo_url_name')
            kwargs['update_fields'] = list(update_fields)
        super().save(*args, **kwargs)

    def _generate_url_name(self) -> str:
        base_slug = slugify(self.name, allow_unicode=True)
        if not base_slug:
            raise ValueError(f"Не удалось построить URL-имя для товара '{self.name}'")
        slug_candidate = base_slug
        suffix = 2
        model = self.__class__
        queryset = model.objects.exclude(pk=self.pk) if self.pk else model.objects.all()
        while queryset.filter(seo_url_name=slug_candidate).exists():
            slug_candidate = f'{base_slug}-{suffix}'
            suffix += 1
        return slug_candidate

    def calculate_volume(self) -> int | None:
        """Attempt to calculate volume in cubic centimetres from dimensions."""

        if self.dimensions_shape == DimensionShape.BOX_HEIGHT_WIDTH_DEPTH:
            if self.box_height_cm and self.box_width_cm and self.box_depth_cm:
                return int(
                    Decimal(self.box_height_cm)
                    * Decimal(self.box_width_cm)
                    * Decimal(self.box_depth_cm)
                )
        if self.dimensions_shape == DimensionShape.CYLINDER_DIAMETER_HEIGHT:
            if self.cylinder_diameter_cm and self.cylinder_height_cm:
                radius = Decimal(self.cylinder_diameter_cm) / Decimal('2')
                base_area = Decimal(math.pi) * radius * radius
                return int(base_area * Decimal(self.cylinder_height_cm))
        return None


class ProductImage(Date):
    """Image for a product with explicit order."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name='Товар',
    )
    file = models.ImageField(
        'Файл',
        upload_to=PathAndRename(''),
        storage=product_image_storage,
    )
    position = models.PositiveIntegerField('Позиция', default=1)

    class Meta(Date.Meta):
        verbose_name = 'Изображение товара'
        verbose_name_plural = 'Изображения товара'
        ordering = ['position', 'created']

    def __str__(self) -> str:  # pragma: no cover - human readable repr
        return f'Image {self.id} for {self.product_id}'

    @property
    def url(self) -> str:
        return self.file.url if self.file else ''

    def save(self, *args, process_image: bool = True, **kwargs):  # type: ignore[override]
        update_fields = kwargs.get('update_fields')
        should_process = process_image and (not update_fields or 'file' in update_fields)
        super().save(*args, **kwargs)
        if should_process and self.file:
            self._process_image()

    def _process_image(self) -> None:
        """Crop the image to a 2000x2000 JPEG square."""

        if not self.file:
            return

        original_name = self.file.name

        try:
            self.file.open('rb')
            with Image.open(self.file) as img:
                img = ImageOps.exif_transpose(img)
                width, height = img.size
                if not width or not height:
                    return

                min_side = min(width, height)
                left = (width - min_side) / 2
                top = (height - min_side) / 2
                right = left + min_side
                bottom = top + min_side
                img = img.crop((left, top, right, bottom))

                if img.size != (2000, 2000):
                    img = img.resize((2000, 2000), RESAMPLE_STRATEGY)

                if img.mode in {'RGBA', 'LA'} or (img.mode == 'P' and 'transparency' in img.info):
                    rgba_image = img.convert('RGBA')
                    background = Image.new('RGB', rgba_image.size, (255, 255, 255))
                    background.paste(rgba_image, mask=rgba_image.split()[-1])
                    img = background
                else:
                    img = img.convert('RGB')

                buffer = BytesIO()
                img.save(buffer, format='JPEG', quality=85, optimize=True)
        except Exception:  # pragma: no cover - we don't expect processing to fail in tests
            logger.exception('Failed to process product image %s', self.pk)
            return
        finally:
            try:
                self.file.close()
            except Exception:  # pragma: no cover - defensive cleanup
                pass

        buffer.seek(0)
        self.file.save(f'{self.id}.jpg', ContentFile(buffer.getvalue()), save=False)

        if original_name and original_name != self.file.name:
            try:
                self.file.storage.delete(original_name)
            except Exception:  # pragma: no cover - best effort cleanup
                logger.warning('Failed to delete original product image %s', original_name)

        super().save(update_fields=['file'], process_image=False)


__all__ = ['Category', 'Product', 'ProductImage']

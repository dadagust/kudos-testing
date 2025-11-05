"""Database models for the products domain."""

from __future__ import annotations

import logging
import math
import uuid
from decimal import Decimal
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify
from PIL import Image, ImageOps

from applications.core.models import Date, PathAndRename

from .choices import DimensionShape, RentalMode, ReservationMode


class Color(Date):
    """Available color option for products."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    value = models.CharField(
        verbose_name='Значение',
        max_length=32,
        unique=True,
    )
    label = models.CharField(
        verbose_name='Название',
        max_length=255,
    )

    class Meta(Date.Meta):
        verbose_name = 'Цвет'
        verbose_name_plural = 'Цвета'
        ordering = ['label']

    def __str__(self) -> str:  # pragma: no cover - human readable repr
        return self.label


class TransportRestriction(Date):
    """Available delivery transport restrictions."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    value = models.CharField(
        verbose_name='Значение',
        max_length=32,
        unique=True,
    )
    label = models.CharField(
        verbose_name='Название',
        max_length=255,
    )

    class Meta(Date.Meta):
        verbose_name = 'Ограничение по транспорту'
        verbose_name_plural = 'Ограничения по транспорту'
        ordering = ['label']

    def __str__(self) -> str:  # pragma: no cover - human readable repr
        return self.label


logger = logging.getLogger(__name__)

try:  # pragma: no cover - Pillow version compatibility
    RESAMPLE_STRATEGY = Image.Resampling.LANCZOS
except AttributeError:  # pragma: no cover - fallback for older Pillow
    RESAMPLE_STRATEGY = Image.LANCZOS


class Category(Date):
    """Hierarchical product category."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(
        verbose_name='Название',
        max_length=255,
    )
    parent = models.ForeignKey(
        to='self',
        verbose_name='Родительская категория',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
    )
    slug = models.SlugField(
        verbose_name='Слаг',
        max_length=255,
        unique=True,
    )

    class Meta(Date.Meta):
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'
        ordering = ['name']

    def __str__(self) -> str:  # pragma: no cover - human readable repr
        return self.name


class InstallerQualification(Date):
    """Qualification required for product installation."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(
        verbose_name='Название',
        max_length=255,
        unique=True,
    )
    price_rub = models.DecimalField(
        verbose_name='Стоимость, руб',
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

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(
        verbose_name='Название',
        max_length=255,
    )
    features = models.JSONField(
        verbose_name='Особенности',
        default=list,
        blank=True,
    )
    category = models.ForeignKey(
        to=Category,
        verbose_name='Категория',
        on_delete=models.PROTECT,
        related_name='products',
    )
    complementary_products = models.ManyToManyField(
        to='self',
        verbose_name='Дополняющие изделия',
        symmetrical=False,
        related_name='complemented_by',
        blank=True,
    )
    price_rub = models.DecimalField(
        verbose_name='Стоимость, руб',
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
    )
    loss_compensation_rub = models.DecimalField(
        verbose_name='Компенсация за потерю, руб',
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        null=True,
        blank=True,
    )
    color = models.ForeignKey(
        to=Color,
        verbose_name='Цвет',
        on_delete=models.SET_NULL,
        related_name='products',
        null=True,
        blank=True,
        to_field='value',
        db_column='color',
    )

    dimensions_shape = models.CharField(
        verbose_name='Форма',
        max_length=64,
        choices=DimensionShape.choices,
    )
    circle_diameter_cm = models.DecimalField(
        verbose_name='Диаметр круга, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    line_length_cm = models.DecimalField(
        verbose_name='Длина линии, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    rectangle_length_cm = models.DecimalField(
        verbose_name='Длина прямоугольника, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    rectangle_width_cm = models.DecimalField(
        verbose_name='Ширина прямоугольника, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    cylinder_diameter_cm = models.DecimalField(
        verbose_name='Диаметр цилиндра, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    cylinder_height_cm = models.DecimalField(
        verbose_name='Высота цилиндра, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    box_height_cm = models.DecimalField(
        verbose_name='Высота параллелепипеда, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    box_width_cm = models.DecimalField(
        verbose_name='Ширина параллелепипеда, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    box_depth_cm = models.DecimalField(
        verbose_name='Глубина параллелепипеда, см',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    occupancy_cleaning_days = models.PositiveIntegerField(
        verbose_name='Чистка, дни',
        null=True,
        blank=True,
    )

    description = models.TextField(
        verbose_name='Описание',
        blank=True,
    )

    stock_qty = models.PositiveIntegerField(
        verbose_name='Остаток на складе',
        validators=[MinValueValidator(0)],
        default=0,
    )
    available_stock_qty = models.PositiveIntegerField(
        verbose_name='Доступный остаток на складе',
        validators=[MinValueValidator(0)],
        default=0,
    )

    delivery_volume_cm3 = models.PositiveIntegerField(
        verbose_name='Объём, см3',
        null=True,
        blank=True,
    )
    delivery_weight_kg = models.DecimalField(
        verbose_name='Вес, кг',
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    delivery_transport_restriction = models.ForeignKey(
        to=TransportRestriction,
        verbose_name='Ограничение по транспорту',
        on_delete=models.SET_NULL,
        related_name='products',
        null=True,
        blank=True,
        to_field='value',
        db_column='delivery_transport_restriction',
    )
    delivery_self_pickup_allowed = models.BooleanField(
        verbose_name='Самовывоз разрешён',
        default=False,
    )

    setup_install_minutes = models.PositiveIntegerField(
        verbose_name='Монтаж, мин',
        null=True,
        blank=True,
    )
    setup_uninstall_minutes = models.PositiveIntegerField(
        verbose_name='Демонтаж, мин',
        null=True,
        blank=True,
    )
    setup_installer_qualification = models.ForeignKey(
        to=InstallerQualification,
        verbose_name='Квалификация сетапёров',
        on_delete=models.SET_NULL,
        related_name='products',
        null=True,
        blank=True,
    )
    setup_min_installers = models.PositiveIntegerField(
        verbose_name='Минимум сетапёров',
        choices=[(value, str(value)) for value in range(1, 5)],
        null=True,
        blank=True,
    )
    setup_self_setup_allowed = models.BooleanField(
        verbose_name='Самостоятельный сетап',
        default=False,
    )

    rental_mode = models.CharField(
        verbose_name='Режим аренды',
        max_length=32,
        choices=RentalMode.choices,
        default=RentalMode.STANDARD,
    )
    rental_special_tiers = models.JSONField(
        verbose_name='Тарифы аренды (особый)',
        default=list,
        blank=True,
    )

    visibility_reservation_mode = models.CharField(
        verbose_name='Бронирование',
        max_length=32,
        choices=ReservationMode.choices,
        blank=True,
    )
    visibility_show_on_pifakit = models.BooleanField(
        verbose_name='На pifakit',
        default=False,
    )
    visibility_show_on_site = models.BooleanField(
        verbose_name='На сайте',
        default=False,
    )
    visibility_show_in_new = models.BooleanField(
        verbose_name='Новинки',
        default=False,
    )
    visibility_category_cover_on_home = models.BooleanField(
        verbose_name='Обложка категории',
        default=False,
    )

    seo_url_name = models.SlugField(
        verbose_name='URL имя',
        max_length=255,
        unique=True,
    )
    seo_meta_title = models.CharField(
        verbose_name='Meta title',
        max_length=255,
        blank=True,
    )
    seo_meta_description = models.CharField(
        verbose_name='Meta description',
        max_length=500,
        blank=True,
    )

    class Meta(Date.Meta):
        verbose_name = 'Товар'
        verbose_name_plural = 'Товары'
        ordering = ['-created']
        indexes = [
            models.Index(
                fields=('name',),
                name='product_name_idx',
            ),
            models.Index(
                fields=('category',),
                name='product_category_idx',
            ),
            models.Index(
                fields=('color',),
                name='product_color_idx',
            ),
        ]

    @property
    def in_stock(self) -> bool:
        return self.stock_qty > 0

    @property
    def available_in_stock(self) -> bool:
        return self.available_stock_qty > 0

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


class OrderStockTransactionType(models.TextChoices):
    RESERVATION = 'reservation', 'Резервирование заказа'
    ISSUE = 'issue', 'Списание по заказу'
    RETURN = 'return', 'Возврат по заказу'


class StockTransaction(Date):
    """Inventory transaction affecting product stock levels."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    product = models.ForeignKey(
        to=Product,
        verbose_name='Товар',
        on_delete=models.CASCADE,
        related_name='stock_transactions',
    )
    quantity_delta = models.IntegerField(
        verbose_name='Изменение количества',
        help_text='Положительное значение увеличивает склад, отрицательное уменьшает.',
    )
    affects_stock = models.BooleanField(
        verbose_name='Влияет на складской остаток',
        default=True,
        help_text='Если выключено, фактический складской остаток не изменится.',
    )
    affects_available = models.BooleanField(
        verbose_name='Влияет на доступный остаток',
        default=True,
        help_text='Если включено, доступный остаток изменится вместе с реальным.',
    )
    is_applied = models.BooleanField(
        verbose_name='Транзакция применена',
        default=True,
        help_text='Неприменённые транзакции используются для планирования и не влияют на остатки.',
    )
    scheduled_for = models.DateTimeField(
        verbose_name='Запланировано на',
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        verbose_name='Пользователь',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_transactions',
    )
    created_by_name = models.CharField(
        verbose_name='Имя пользователя',
        max_length=255,
        blank=True,
    )
    note = models.CharField(
        verbose_name='Комментарий',
        max_length=255,
        blank=True,
    )
    order = models.ForeignKey(
        to='orders.Order',
        verbose_name='Заказ',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='stock_transactions',
    )
    order_transaction_type = models.CharField(
        verbose_name='Тип транзакции заказа',
        max_length=32,
        choices=OrderStockTransactionType.choices,
        null=True,
        blank=True,
    )

    class Meta(Date.Meta):
        verbose_name = 'Складская транзакция'
        verbose_name_plural = 'Складские транзакции'
        ordering = ['-created']
        constraints = [
            models.UniqueConstraint(
                fields=('order', 'order_transaction_type', 'product'),
                name='unique_order_transaction_per_product',
            )
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable repr
        return f'{self.product.name}: {self.quantity_delta}'

    def _resolve_user_display_name(self) -> str:
        if not self.created_by:
            return ''

        full_name = self.created_by.get_full_name()
        if full_name:
            return full_name

        email = getattr(self.created_by, 'email', '') or ''
        if email:
            return email

        return self.created_by.get_username()

    def save(self, *args, **kwargs):
        if self.created_by:
            display_name = self._resolve_user_display_name()
            if display_name and self.created_by_name != display_name:
                self.created_by_name = display_name
        super().save(*args, **kwargs)

class ProductImage(Date):
    """Image for a product with explicit order."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    product = models.ForeignKey(
        to=Product,
        verbose_name='Товар',
        on_delete=models.CASCADE,
        related_name='images',
    )
    file = models.ImageField(
        verbose_name='Файл',
        upload_to=PathAndRename('products/product_photo/file'),
    )
    position = models.PositiveIntegerField(
        verbose_name='Позиция',
        default=1,
    )

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

        self.save(update_fields=['file'], process_image=False)


__all__ = [
    'Category',
    'Product',
    'ProductImage',
    'StockTransaction',
    'OrderStockTransactionType',
]

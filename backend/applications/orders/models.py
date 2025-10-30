"""Data models for order management domain."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from applications.core.models import Date
from applications.products.choices import RentalMode
from applications.products.models import Product


class OrderStatus(models.TextChoices):
    NEW = 'new', 'Новый'
    RESERVED = 'reserved', 'В резерве'
    RENTED = 'rented', 'В аренде'
    IN_WORK = 'in_work', 'В работе'
    ARCHIVED = 'archived', 'Архив'
    DECLINED = 'declined', 'Отказ'


class DeliveryType(models.TextChoices):
    DELIVERY = 'delivery', 'Доставка'
    PICKUP = 'pickup', 'Самовывоз'


STATUS_GROUP_MAP: dict[str, tuple[str, ...]] = {
    'current': (
        OrderStatus.NEW,
        OrderStatus.RESERVED,
        OrderStatus.RENTED,
        OrderStatus.IN_WORK,
    ),
    'archived': (OrderStatus.ARCHIVED,),
    'cancelled': (OrderStatus.DECLINED,),
}


class OrderQuerySet(models.QuerySet):
    def for_status_group(self, group: str | None) -> OrderQuerySet:
        if not group:
            return self
        statuses = STATUS_GROUP_MAP.get(group)
        if not statuses:
            return self
        return self.filter(status__in=statuses)


class Order(Date):
    """Represents a customer order."""

    status = models.CharField(
        verbose_name='Статус',
        max_length=32,
        choices=OrderStatus.choices,
        default=OrderStatus.NEW,
    )
    total_amount = models.DecimalField(
        verbose_name='Сумма заказа',
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
    )
    installation_date = models.DateField(
        verbose_name='Дата монтажа',
    )
    dismantle_date = models.DateField(
        verbose_name='Дата демонтажа',
    )
    customer = models.ForeignKey(
        to='customers.Customer',
        verbose_name='Клиент',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    delivery_type = models.CharField(
        verbose_name='Тип доставки',
        max_length=32,
        choices=DeliveryType.choices,
        default=DeliveryType.DELIVERY,
    )
    delivery_address = models.CharField(
        verbose_name='Адрес доставки',
        max_length=255,
        blank=True,
    )
    comment = models.TextField(
        verbose_name='Комментарий',
        blank=True,
    )

    objects = OrderQuerySet.as_manager()

    class Meta(Date.Meta):
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        ordering = ['-created']

    def __str__(self) -> str:  # pragma: no cover - human readable representation
        return f'Заказ #{self.pk}'

    def recalculate_total_amount(self) -> Decimal:
        items = list(self.items.select_related('product__setup_installer_qualification'))
        total = sum((item.subtotal for item in items), Decimal('0.00'))

        qualification_total = Decimal('0.00')
        seen_products: set[int] = set()
        for item in items:
            product = item.product
            if not product:
                continue
            product_id = product.pk
            if product_id is None:
                continue
            if product_id in seen_products:
                continue
            seen_products.add(product_id)
            qualification = product.setup_installer_qualification
            if not qualification:
                continue
            qualification_total += qualification.price_rub or Decimal('0.00')

        total += qualification_total
        self.total_amount = total
        return total


class OrderItem(Date):
    """Line item for a specific product in an order."""

    order = models.ForeignKey(
        to=Order,
        verbose_name='Заказ',
        on_delete=models.CASCADE,
        related_name='items',
    )
    product = models.ForeignKey(
        to=Product,
        verbose_name='Товар',
        on_delete=models.PROTECT,
        related_name='order_items',
        null=True,
        blank=True,
    )
    product_name = models.CharField(
        verbose_name='Название товара',
        max_length=255,
        blank=True,
    )
    quantity = models.PositiveIntegerField(
        verbose_name='Количество',
        default=1,
        validators=[MinValueValidator(1)],
    )
    unit_price = models.DecimalField(
        verbose_name='Цена за единицу',
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    rental_days = models.PositiveIntegerField(
        verbose_name='Дней аренды',
        default=1,
        validators=[MinValueValidator(1)],
    )
    rental_mode = models.CharField(
        verbose_name='Режим аренды',
        max_length=32,
        choices=RentalMode.choices,
        default=RentalMode.STANDARD,
    )
    rental_tiers_snapshot = models.JSONField(
        verbose_name='Снимок тарифов аренды',
        default=list,
        blank=True,
    )

    class Meta(Date.Meta):
        verbose_name = 'Позиция заказа'
        verbose_name_plural = 'Позиции заказов'
        ordering = ['created']

    def __str__(self) -> str:  # pragma: no cover - human readable representation
        return f'{self.product_name} x {self.quantity}'

    @property
    def subtotal(self) -> Decimal:
        return self.unit_price * self.quantity

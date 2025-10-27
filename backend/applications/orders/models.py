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
        'Статус', max_length=32, choices=OrderStatus.choices, default=OrderStatus.NEW
    )
    total_amount = models.DecimalField(
        'Сумма заказа', max_digits=12, decimal_places=2, default=Decimal('0.00')
    )
    installation_date = models.DateField('Дата монтажа')
    dismantle_date = models.DateField('Дата демонтажа')
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='Клиент',
    )
    delivery_type = models.CharField(
        'Тип доставки',
        max_length=32,
        choices=DeliveryType.choices,
        default=DeliveryType.DELIVERY,
    )
    delivery_address = models.CharField('Адрес доставки', max_length=255, blank=True)
    comment = models.TextField('Комментарий', blank=True)

    objects = OrderQuerySet.as_manager()

    class Meta(Date.Meta):
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        ordering = ['-created']

    def __str__(self) -> str:  # pragma: no cover - human readable representation
        return f'Заказ #{self.pk}'

    def recalculate_total_amount(self) -> Decimal:
        total = sum((item.subtotal for item in self.items.all()), Decimal('0.00'))
        self.total_amount = total
        return total


class OrderItem(Date):
    """Line item for a specific product in an order."""

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Заказ',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='order_items',
        verbose_name='Товар',
        null=True,
        blank=True,
    )
    product_name = models.CharField('Название товара', max_length=255, blank=True)
    quantity = models.PositiveIntegerField(
        'Количество', default=1, validators=[MinValueValidator(1)]
    )
    unit_price = models.DecimalField(
        'Цена за единицу',
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    rental_days = models.PositiveIntegerField(
        'Дней аренды', default=1, validators=[MinValueValidator(1)]
    )
    rental_mode = models.CharField(
        'Режим аренды',
        max_length=32,
        choices=RentalMode.choices,
        default=RentalMode.STANDARD,
    )
    rental_tiers_snapshot = models.JSONField(
        'Снимок тарифов аренды',
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

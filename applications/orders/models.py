"""Data models for order management."""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from applications.core.models import Date


class OrderStatus(models.TextChoices):
    NEW = 'new', 'Новый'
    RESERVED = 'reserved', 'В резерве'
    IN_RENT = 'in_rent', 'В аренде'
    IN_PROGRESS = 'in_progress', 'В работе'
    ARCHIVED = 'archived', 'Архив'
    CANCELLED = 'cancelled', 'Отказ'


class DeliveryOption(models.TextChoices):
    DELIVERY = 'delivery', 'Доставка'
    PICKUP = 'pickup', 'Самовывоз'


class ProductChoices(models.TextChoices):
    PRODUCT_1 = 'product_1', 'Товар 1'
    PRODUCT_2 = 'product_2', 'Товар 2'


PRODUCT_PRICE_MAP: dict[str, Decimal] = {
    ProductChoices.PRODUCT_1: Decimal('1500.00'),
    ProductChoices.PRODUCT_2: Decimal('3200.00'),
}


class Order(Date):
    """Commercial order that aggregates requested products."""

    status = models.CharField(
        'Статус',
        max_length=32,
        choices=OrderStatus.choices,
        default=OrderStatus.NEW,
    )
    total_amount = models.DecimalField('Сумма заказа', max_digits=12, decimal_places=2, default=0)
    installation_date = models.DateField('Дата монтажа')
    dismantle_date = models.DateField('Дата демонтажа')
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        related_name='orders',
        null=True,
        blank=True,
    )
    delivery_option = models.CharField(
        'Способ получения',
        max_length=16,
        choices=DeliveryOption.choices,
        default=DeliveryOption.DELIVERY,
    )
    delivery_address = models.CharField('Адрес доставки', max_length=255, blank=True)
    comment = models.TextField('Комментарий', blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='created_orders',
        null=True,
        blank=True,
    )

    class Meta(Date.Meta):
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        ordering = ('-created',)

    def __str__(self) -> str:  # pragma: no cover
        return f'Заказ #{self.pk}'

    def recalculate_total_amount(self) -> None:
        total = Decimal('0.00')
        for item in self.items.all():
            total += item.amount
        self.total_amount = total
        Order.objects.filter(pk=self.pk).update(total_amount=total)


class OrderItem(Date):
    """Individual item within an order."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.CharField('Товар', max_length=32, choices=ProductChoices.choices)
    quantity = models.PositiveIntegerField('Количество', default=1)

    class Meta(Date.Meta):
        verbose_name = 'Позиция заказа'
        verbose_name_plural = 'Позиции заказа'

    def __str__(self) -> str:  # pragma: no cover
        return f'{self.get_product_display()} x {self.quantity}'

    @property
    def unit_price(self) -> Decimal:
        return PRODUCT_PRICE_MAP.get(self.product, Decimal('0.00'))

    @property
    def amount(self) -> Decimal:
        return self.unit_price * Decimal(self.quantity)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.order.recalculate_total_amount()

    def delete(self, *args, **kwargs):
        order = self.order
        super().delete(*args, **kwargs)
        order.recalculate_total_amount()

"""Data models for order management domain."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _


class TimeStampedModel(models.Model):
    """Abstract base model providing audit fields."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ('-created_at',)


class DeliveryMethod(models.TextChoices):
    DELIVERY = 'delivery', _('Доставка')
    PICKUP = 'pickup', _('Самовывоз')


class OrderStatus(models.TextChoices):
    NEW = 'new', _('Новый')
    RESERVED = 'reserved', _('В резерве')
    IN_RENT = 'in_rent', _('В аренде')
    IN_PROGRESS = 'in_progress', _('В работе')
    ARCHIVED = 'archived', _('Архив')
    CANCELLED = 'cancelled', _('Отказ')


class Order(TimeStampedModel):
    """Commercial order placed by a customer or staff member."""

    id = models.BigAutoField(primary_key=True)
    status = models.CharField(
        'Статус', max_length=32, choices=OrderStatus.choices, default=OrderStatus.NEW
    )
    installation_date = models.DateField('Дата монтажа')
    dismantle_date = models.DateField('Дата демонтажа')
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    delivery_method = models.CharField(
        'Способ доставки',
        max_length=16,
        choices=DeliveryMethod.choices,
        default=DeliveryMethod.DELIVERY,
    )
    delivery_address = models.CharField('Адрес доставки', max_length=255, blank=True)
    comment = models.TextField('Комментарий', blank=True)
    total_amount = models.DecimalField('Сумма заказа', max_digits=12, decimal_places=2, default=0)

    class Meta(TimeStampedModel.Meta):
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        indexes = [
            models.Index(fields=('status',), name='order_status_idx'),
            models.Index(fields=('installation_date',), name='order_installation_date_idx'),
            models.Index(fields=('dismantle_date',), name='order_dismantle_date_idx'),
            models.Index(fields=('customer',), name='order_customer_idx'),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable representation
        return f'Заказ #{self.pk}'

    @property
    def number(self) -> str:
        return f'ORD-{self.pk:05d}' if self.pk else 'ORD-new'

    def reset_totals(self) -> None:
        """Recalculate the order total based on active items."""

        total = self.items.filter(is_active=True).aggregate(sum=models.Sum('total_price'))['sum']
        self.total_amount = total or Decimal('0')
        self.save(update_fields=['total_amount', 'updated_at'])


class ProductCode(models.TextChoices):
    PRODUCT_1 = 'product1', _('Товар 1')
    PRODUCT_2 = 'product2', _('Товар 2')
    PRODUCT_3 = 'product3', _('Товар 3')


@dataclass(frozen=True)
class ProductCatalogEntry:
    code: str
    price: Decimal


PRODUCT_CATALOG: dict[str, ProductCatalogEntry] = {
    ProductCode.PRODUCT_1: ProductCatalogEntry(ProductCode.PRODUCT_1, Decimal('1500.00')),
    ProductCode.PRODUCT_2: ProductCatalogEntry(ProductCode.PRODUCT_2, Decimal('2750.00')),
    ProductCode.PRODUCT_3: ProductCatalogEntry(ProductCode.PRODUCT_3, Decimal('4200.00')),
}


class OrderItem(TimeStampedModel):
    """Individual line item that belongs to an order."""

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name='items', verbose_name='Заказ'
    )
    product = models.CharField(
        'Товар', max_length=32, choices=ProductCode.choices, default=ProductCode.PRODUCT_1
    )
    quantity = models.PositiveIntegerField('Количество', default=1)
    unit_price = models.DecimalField('Цена за единицу', max_digits=12, decimal_places=2)
    total_price = models.DecimalField('Стоимость позиции', max_digits=12, decimal_places=2)

    class Meta(TimeStampedModel.Meta):
        verbose_name = 'Позиция заказа'
        verbose_name_plural = 'Позиции заказа'
        indexes = [models.Index(fields=('order',), name='order_item_order_idx')]

    def __str__(self) -> str:  # pragma: no cover - human readable representation
        return f'{self.get_product_display()} × {self.quantity}'

    def save(self, *args, **kwargs):
        if self.unit_price in (None, ''):
            self.unit_price = self.get_unit_price(self.product)
        self.total_price = (self.unit_price or Decimal('0')) * Decimal(self.quantity or 0)
        super().save(*args, **kwargs)

    @staticmethod
    def get_unit_price(product_code: str) -> Decimal:
        entry = PRODUCT_CATALOG.get(product_code)
        return entry.price if entry else Decimal('0')


__all__ = [
    'DeliveryMethod',
    'Order',
    'OrderItem',
    'OrderStatus',
    'ProductCatalogEntry',
    'ProductCode',
    'PRODUCT_CATALOG',
]

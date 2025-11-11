from __future__ import annotations

from datetime import date, time
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from applications.orders.models import DeliveryType, Order, OrderItem, PaymentStatus
from applications.products.models import (
    Category,
    OrderStockTransactionType,
    Product,
    StockTransaction,
)


class OrderWaybillPdfViewTests(TestCase):
    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username='viewer@example.com',
            email='viewer@example.com',
            password='StrongPass123!',
        )
        order_perm = Permission.objects.get(codename='view_order')
        logistics_perm = Permission.objects.get(
            codename='view_logistics', content_type__app_label='adminpanel'
        )
        self.user.user_permissions.add(order_perm, logistics_perm)
        self.client.force_login(self.user)

        self.category = Category.objects.create(name='Текстиль', slug='textile')
        self.product = Product.objects.create(
            name='Скатерть',
            category=self.category,
            price_rub=Decimal('1200.00'),
            dimensions_shape='line__length',
            line_length_cm=Decimal('100'),
            delivery_volume_cm3=1000,
            delivery_weight_kg=Decimal('1.2'),
        )
        self.order = Order.objects.create(
            installation_date=date(2024, 6, 1),
            mount_datetime_from=time(9, 0),
            mount_datetime_to=time(11, 0),
            dismantle_date=date(2024, 6, 5),
            dismount_datetime_from=time(18, 0),
            dismount_datetime_to=time(20, 0),
            shipment_date=date(2024, 5, 31),
            delivery_type=DeliveryType.DELIVERY,
            delivery_address_input='Москва, ул. Тестовая, д. 1',
            comment='Проверочный заказ',
            payment_status=PaymentStatus.PAID,
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            product_name=self.product.name,
            quantity=3,
            unit_price=Decimal('1200.00'),
        )
        StockTransaction.objects.create(
            order=self.order,
            product=self.product,
            quantity_delta=2,
            affects_stock=True,
            affects_available=True,
            order_transaction_type=OrderStockTransactionType.RETURN,
        )

    def _build_url(self, context: str) -> str:
        base = reverse('logistics:order_waybill_pdf', args=[self.order.pk])
        return f'{base}?context={context}'

    def test_prep_context_includes_planned_quantities(self) -> None:
        captured: dict[str, object] = {}

        def capture_render(template_name, context, *args, **kwargs):  # type: ignore[override]
            captured['context'] = context
            return '<html></html>'

        with patch('applications.logistics.views.waybill.render_to_string', side_effect=capture_render), \
                patch('applications.logistics.views.waybill.HTML.write_pdf', return_value=b'%PDF-1.4 stub%'):
            response = self.client.get(self._build_url('prep'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        disposition = response['Content-Disposition']
        self.assertIn('inline;', disposition)
        self.assertIn(f'waybill-{self.order.pk}', disposition)

        context = captured['context']
        self.assertEqual(context['context_kind'], 'prep')
        items = context['items']
        self.assertTrue(items)
        first_item = items[0]
        self.assertEqual(first_item.quantity_planned, '3')
        self.assertEqual(first_item.quantity_returned, '')

    def test_receiving_context_uses_return_quantities(self) -> None:
        captured: dict[str, object] = {}

        def capture_render(template_name, context, *args, **kwargs):  # type: ignore[override]
            captured['context'] = context
            return '<html></html>'

        with patch('applications.logistics.views.waybill.render_to_string', side_effect=capture_render), \
                patch('applications.logistics.views.waybill.HTML.write_pdf', return_value=b'%PDF-1.4 stub%'):
            response = self.client.get(self._build_url('receiving'))

        self.assertEqual(response.status_code, 200)
        context = captured['context']
        self.assertEqual(context['context_kind'], 'receiving')
        first_item = context['items'][0]
        self.assertEqual(first_item.quantity_planned, '')
        self.assertEqual(first_item.quantity_returned, '2')

    def test_forbidden_without_permissions(self) -> None:
        user_without_access = get_user_model().objects.create_user(
            username='limited@example.com',
            email='limited@example.com',
            password='ChangeMe123!',
        )
        self.client.force_login(user_without_access)
        response = self.client.get(self._build_url('prep'))
        self.assertEqual(response.status_code, 403)

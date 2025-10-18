"""API tests for orders domain."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.core.models import RoleChoices
from applications.customers.models import Customer

from .models import DeliveryMethod, Order, OrderItem, OrderStatus, ProductCode


class OrderApiTests(APITestCase):
    maxDiff = None

    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user(
            username='manager@example.com',
            email='manager@example.com',
            password='ChangeMe123!',
        )
        profile = self.user.profile
        profile.role = RoleChoices.SALES_MANAGER
        profile.save(update_fields=['role'])
        self.client.force_authenticate(self.user)
        self.list_url = reverse('orders:order-list')

    def _create_payload(self, **overrides):
        payload = {
            'status': OrderStatus.NEW,
            'installation_date': '2024-05-01',
            'dismantle_date': '2024-05-05',
            'delivery_method': DeliveryMethod.DELIVERY,
            'delivery_address': 'Москва, ул. Тверская, 1',
            'comment': 'Подготовить площадку',
            'items': [
                {'product': ProductCode.PRODUCT_1, 'quantity': 2},
                {'product': ProductCode.PRODUCT_2, 'quantity': 1},
            ],
        }
        payload.update(overrides)
        return payload

    def test_create_order_without_customer(self):
        response = self.client.post(self.list_url, self._create_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        self.assertIsNone(data['customer'])
        self.assertEqual(data['total_amount'], '5750.00')
        self.assertEqual(Order.objects.count(), 1)
        order = Order.objects.get()
        self.assertEqual(order.total_amount, Decimal('5750.00'))

    def test_create_order_with_customer_and_pickup(self):
        customer = Customer.objects.create(display_name='ООО «Событие»')
        payload = self._create_payload(
            customer_id=str(customer.id),
            delivery_method=DeliveryMethod.PICKUP,
            delivery_address='',
        )
        response = self.client.post(self.list_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        self.assertEqual(data['customer'], str(customer.id))
        self.assertEqual(data['delivery_method'], DeliveryMethod.PICKUP)
        self.assertEqual(data['delivery_address'], '')

    def test_update_order_recalculates_total(self):
        response = self.client.post(self.list_url, self._create_payload(), format='json')
        order_id = response.json()['data']['id']
        detail_url = reverse('orders:order-detail', args=[order_id])
        update_payload = {
            'status': OrderStatus.IN_PROGRESS,
            'items': [
                {'product': ProductCode.PRODUCT_3, 'quantity': 1},
                {'product': ProductCode.PRODUCT_2, 'quantity': 2},
            ],
        }
        update = self.client.patch(detail_url, update_payload, format='json')
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        data = update.json()['data']
        self.assertEqual(data['status'], OrderStatus.IN_PROGRESS)
        self.assertEqual(data['total_amount'], '9700.00')
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.total_amount, Decimal('9700.00'))
        self.assertEqual(order.items.count(), 2)

    def test_list_orders_by_scope(self):
        current = Order.objects.create(
            status=OrderStatus.NEW,
            installation_date=date(2024, 6, 1),
            dismantle_date=date(2024, 6, 5),
            delivery_method=DeliveryMethod.DELIVERY,
            delivery_address='Москва',
        )
        OrderItem.objects.create(order=current, product=ProductCode.PRODUCT_1, quantity=1, unit_price=Decimal('1500.00'), total_price=Decimal('1500.00'))
        Order.objects.filter(pk=current.pk).update(total_amount=Decimal('1500.00'))

        archived = Order.objects.create(
            status=OrderStatus.ARCHIVED,
            installation_date=date(2024, 4, 1),
            dismantle_date=date(2024, 4, 5),
            delivery_method=DeliveryMethod.DELIVERY,
            delivery_address='Москва',
        )
        Order.objects.filter(pk=archived.pk).update(total_amount=Decimal('0'))

        cancelled = Order.objects.create(
            status=OrderStatus.CANCELLED,
            installation_date=date(2024, 3, 1),
            dismantle_date=date(2024, 3, 2),
            delivery_method=DeliveryMethod.DELIVERY,
            delivery_address='Москва',
        )
        Order.objects.filter(pk=cancelled.pk).update(total_amount=Decimal('0'))

        response = self.client.get(self.list_url, {'scope': 'current'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()['data']), 1)

        response = self.client.get(self.list_url, {'scope': 'archived'})
        self.assertEqual(len(response.json()['data']), 1)
        self.assertEqual(response.json()['data'][0]['status'], OrderStatus.ARCHIVED)

        response = self.client.get(self.list_url, {'scope': 'cancelled'})
        self.assertEqual(len(response.json()['data']), 1)
        self.assertEqual(response.json()['data'][0]['status'], OrderStatus.CANCELLED)


__all__ = ['OrderApiTests']

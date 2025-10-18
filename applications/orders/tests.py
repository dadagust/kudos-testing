"""API tests for the orders application."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.customers.models import Customer
from applications.orders.models import DeliveryType, OrderProduct, OrderStatus


class OrderApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username='admin@example.com',
            email='admin@example.com',
            password='ChangeMe123!',
        )
        self.client.force_authenticate(self.user)
        self.customer = Customer.objects.create(display_name='Тестовый клиент')

    def test_create_order(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'customer_id': str(self.customer.pk),
            'delivery_type': DeliveryType.DELIVERY,
            'delivery_address': 'Москва, ул. Тестовая, д. 1',
            'comment': 'Проверочный заказ',
            'items': [
                {'product': OrderProduct.PRODUCT_1, 'quantity': 2},
                {'product': OrderProduct.PRODUCT_2, 'quantity': 1},
            ],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        self.assertEqual(data['status'], OrderStatus.NEW)
        self.assertEqual(len(data['items']), 2)
        self.assertEqual(data['delivery_type'], DeliveryType.DELIVERY)
        self.assertEqual(data['customer']['id'], str(self.customer.pk))
        self.assertEqual(data['installation_date'], '2024-06-01')
        self.assertEqual(data['dismantle_date'], '2024-06-05')
        self.assertGreater(float(data['total_amount']), 0)

    def test_list_orders_filtered_by_group(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'delivery_type': DeliveryType.PICKUP,
            'items': [{'product': OrderProduct.PRODUCT_1, 'quantity': 1}],
            'status': OrderStatus.ARCHIVED,
        }
        self.client.post(url, payload, format='json')

        response = self.client.get(url, {'status_group': 'archived'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['status'], OrderStatus.ARCHIVED)

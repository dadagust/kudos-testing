"""API tests for the orders application."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.customers.models import Customer
from applications.orders.models import DeliveryType, OrderStatus
from applications.products.models import Category, InstallerQualification, Product


class OrderApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username='admin@example.com',
            email='admin@example.com',
            password='ChangeMe123!',
        )
        self.client.force_authenticate(self.user)
        self.customer = Customer.objects.create(display_name='Тестовый клиент')
        self.category = Category.objects.create(name='Текстиль', slug='textile')
        self.installer_qualification = InstallerQualification.objects.create(
            name='Квалификация A',
            price_rub='500.00',
        )
        self.product = Product.objects.create(
            name='Скатерть Амори',
            category=self.category,
            price_rub='2700.00',
            dimensions_shape='line__length',
            line_length_cm=100,
            delivery_weight_kg='1.00',
            delivery_volume_cm3=1000,
        )
        self.product.setup_installer_qualification = self.installer_qualification
        self.product.save(update_fields=['setup_installer_qualification'])

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
                {'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1},
            ],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        self.assertEqual(data['status'], OrderStatus.NEW)
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['delivery_type'], DeliveryType.DELIVERY)
        self.assertEqual(data['customer']['id'], str(self.customer.pk))
        self.assertEqual(data['installation_date'], '2024-06-01')
        self.assertEqual(data['dismantle_date'], '2024-06-05')
        self.assertGreater(float(data['total_amount']), 0)
        item = data['items'][0]
        self.assertEqual(item['rental_days'], 1)
        self.assertEqual(item['rental_mode'], 'standard')
        self.assertIsNone(item['rental_tiers'])
        self.assertAlmostEqual(float(item['unit_price']), 2700.0, places=2)
        self.assertAlmostEqual(float(data['total_amount']), 5900.0, places=2)

    def test_list_orders_filtered_by_group(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'delivery_type': DeliveryType.PICKUP,
            'items': [{'product_id': str(self.product.pk), 'quantity': 1, 'rental_days': 1}],
            'status': OrderStatus.ARCHIVED,
        }
        self.client.post(url, payload, format='json')

        response = self.client.get(url, {'status_group': 'archived'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['status'], OrderStatus.ARCHIVED)

    def test_create_pickup_order_without_address_and_comment(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-07-10',
            'dismantle_date': '2024-07-12',
            'delivery_type': DeliveryType.PICKUP,
            'delivery_address': '',
            'comment': '',
            'items': [{'product_id': str(self.product.pk), 'quantity': 3, 'rental_days': 1}],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        self.assertEqual(data['delivery_type'], DeliveryType.PICKUP)
        self.assertEqual(data['delivery_address'], '')
        self.assertEqual(data['comment'], '')

    def test_create_order_with_special_rental(self):
        self.product.rental_mode = 'special'
        self.product.rental_special_tiers = [
            {'end_day': 3, 'price_per_day': '2500.00'},
            {'end_day': 7, 'price_per_day': '2200.00'},
        ]
        self.product.save()

        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-08-01',
            'dismantle_date': '2024-08-05',
            'delivery_type': DeliveryType.DELIVERY,
            'items': [
                {
                    'product_id': str(self.product.pk),
                    'quantity': 1,
                    'rental_days': 5,
                }
            ],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        item = data['items'][0]
        self.assertEqual(item['rental_mode'], 'special')
        self.assertEqual(item['rental_days'], 5)
        self.assertEqual(len(item['rental_tiers']), 2)
        self.assertEqual(item['rental_tiers'][0]['end_day'], 3)
        self.assertAlmostEqual(float(item['unit_price']), 11900.0, places=2)
        self.assertAlmostEqual(float(data['total_amount']), 12400.0, places=2)

    def test_installer_qualification_counted_once(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-09-01',
            'dismantle_date': '2024-09-05',
            'items': [
                {'product_id': str(self.product.pk), 'quantity': 1, 'rental_days': 1},
                {'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1},
            ],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()['data']
        # unit price 2700 * (1 + 2) = 8100, qualification price 500 added once
        self.assertAlmostEqual(float(data['total_amount']), 8600.0, places=2)

    def test_calculate_total_endpoint(self):
        url = reverse('orders:order-calculate-total')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'delivery_type': DeliveryType.DELIVERY,
            'items': [
                {'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1},
            ],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']
        self.assertIn('total_amount', data)
        self.assertAlmostEqual(float(data['total_amount']), 5900.0, places=2)
        self.assertIn('items', data)
        self.assertEqual(len(data['items']), 1)

"""API tests for the orders application."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.customers.models import Customer
from applications.orders.models import DeliveryType, OrderStatus
from applications.products.models import (
    Category,
    InstallerQualification,
    OrderStockTransactionType,
    Product,
    StockTransaction,
)


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
        self.product.stock_qty = 10
        self.product.available_stock_qty = 10
        self.product.save(
            update_fields=['setup_installer_qualification', 'stock_qty', 'available_stock_qty']
        )

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
        self.assertAlmostEqual(float(data['services_total_amount']), 500.0, places=2)
        item = data['items'][0]
        self.assertEqual(item['rental_days'], 1)
        self.assertEqual(item['rental_mode'], 'standard')
        self.assertIsNone(item['rental_tiers'])
        self.assertAlmostEqual(float(item['unit_price']), 2700.0, places=2)
        self.assertAlmostEqual(float(data['total_amount']), 5900.0, places=2)

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 8)

    def test_list_orders_filtered_by_group(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'delivery_type': DeliveryType.PICKUP,
            'items': [{'product_id': str(self.product.pk), 'quantity': 1, 'rental_days': 1}],
            'status': OrderStatus.ARCHIVED,
            'return_items': [
                {'product_id': str(self.product.pk), 'quantity': 1},
            ],
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
        self.assertIn('services_total_amount', data)

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
        self.assertAlmostEqual(float(data['services_total_amount']), 500.0, places=2)

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
        self.assertAlmostEqual(float(data['services_total_amount']), 500.0, places=2)

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

    def test_cannot_create_order_when_stock_is_insufficient(self):
        self.product.available_stock_qty = 1
        self.product.save(update_fields=['available_stock_qty'])

        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1}],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        body = response.json()
        self.assertIn('items', body)
        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 1)

    def test_updating_order_restores_previous_reservations(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 3, 'rental_days': 1}],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 7)

        update_url = reverse('orders:order-detail', args=[order_id])
        update_payload = {
            'installation_date': '2024-06-02',
            'dismantle_date': '2024-06-06',
            'items': [{'product_id': str(self.product.pk), 'quantity': 1, 'rental_days': 1}],
        }
        response = self.client.put(update_url, update_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 9)

    def test_cancelling_and_reopening_order_updates_stock(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1}],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 8)

        detail_url = reverse('orders:order-detail', args=[order_id])
        response = self.client.patch(detail_url, {'status': OrderStatus.DECLINED}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 10)

        response = self.client.patch(detail_url, {'status': OrderStatus.NEW}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 8)

    def test_deleting_order_restores_stock(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1}],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 8)

        detail_url = reverse('orders:order-detail', args=[order_id])
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 10)

    def test_reservation_transactions_created_on_order_creation(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 3, 'rental_days': 1}],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        reservations = StockTransaction.objects.filter(
            order_id=order_id,
            order_transaction_type=OrderStockTransactionType.RESERVATION,
        )
        self.assertEqual(reservations.count(), 1)
        reservation = reservations.get()
        self.assertEqual(reservation.quantity_delta, -3)
        self.assertFalse(reservation.affects_stock)
        self.assertTrue(reservation.affects_available)

    def test_in_work_status_creates_issue_transactions_once(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1}],
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        detail_url = reverse('orders:order-detail', args=[order_id])
        response = self.client.patch(detail_url, {'status': OrderStatus.IN_WORK}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        issue_transactions = StockTransaction.objects.filter(
            order_id=order_id,
            order_transaction_type=OrderStockTransactionType.ISSUE,
        )
        self.assertEqual(issue_transactions.count(), 1)
        issue = issue_transactions.get()
        self.assertEqual(issue.quantity_delta, -2)
        self.assertTrue(issue.affects_stock)
        self.assertFalse(issue.affects_available)

        # Re-applying the same status should not create duplicates.
        response = self.client.patch(detail_url, {'status': OrderStatus.IN_WORK}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            StockTransaction.objects.filter(
                order_id=order_id,
                order_transaction_type=OrderStockTransactionType.ISSUE,
            ).count(),
            1,
        )

    def test_archived_status_requires_return_items(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 1, 'rental_days': 1}],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        detail_url = reverse('orders:order-detail', args=[order_id])
        response = self.client.patch(detail_url, {'status': OrderStatus.ARCHIVED}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_archived_status_creates_return_transactions(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1}],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        detail_url = reverse('orders:order-detail', args=[order_id])
        response = self.client.patch(detail_url, {'status': OrderStatus.IN_WORK}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.patch(
            detail_url,
            {
                'status': OrderStatus.ARCHIVED,
                'return_items': [
                    {'product_id': str(self.product.pk), 'quantity': 1},
                ],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returns = StockTransaction.objects.filter(
            order_id=order_id,
            order_transaction_type=OrderStockTransactionType.RETURN,
        )
        self.assertEqual(returns.count(), 1)
        transaction = returns.get()
        self.assertEqual(transaction.quantity_delta, 1)
        self.assertTrue(transaction.affects_stock)
        self.assertTrue(transaction.affects_available)

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 9)
        self.assertEqual(self.product.stock_qty, 9)

    def test_declined_status_removes_all_transactions(self):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1}],
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.json()['data']['id']

        detail_url = reverse('orders:order-detail', args=[order_id])
        self.client.patch(detail_url, {'status': OrderStatus.IN_WORK}, format='json')
        self.client.patch(
            detail_url,
            {
                'status': OrderStatus.ARCHIVED,
                'return_items': [
                    {'product_id': str(self.product.pk), 'quantity': 2},
                ],
            },
            format='json',
        )

        response = self.client.patch(detail_url, {'status': OrderStatus.DECLINED}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertFalse(StockTransaction.objects.filter(order_id=order_id).exists())
        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 10)
        self.assertEqual(self.product.stock_qty, 10)

"""API tests for the orders application."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.customers.models import Customer
from applications.orders.models import (
    DeliveryType,
    LogisticsState,
    Order,
    OrderDriver,
    OrderStatus,
    PaymentStatus,
)
from applications.products.models import (
    Category,
    InstallerQualification,
    OrderStockTransactionType,
    Product,
    StockTransaction,
    TransportRestriction,
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
        self.any_qualification = InstallerQualification.objects.create(
            name='Любой',
            price_rub='0.00',
            minimal_price_rub='0.00',
            hour_price_rub='0.00',
        )
        self.installer_qualification = InstallerQualification.objects.create(
            name='Квалификация A',
            price_rub='0.00',
            minimal_price_rub='500.00',
            hour_price_rub='400.00',
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
        self.product.setup_install_minutes = Decimal('90')
        self.product.setup_uninstall_minutes = Decimal('45')
        self.product.setup_min_installers = 2
        self.product.stock_qty = 10
        self.product.available_stock_qty = 10
        self.transport_restriction = TransportRestriction.objects.create(
            value='any',
            label='Любой',
            capacity_volume_cm3=1500,
            cost_per_km_rub='5.00',
            cost_per_transport_rub='100.00',
        )
        self.product.delivery_transport_restriction = self.transport_restriction
        self.product.save(
            update_fields=[
                'setup_installer_qualification',
                'setup_install_minutes',
                'setup_uninstall_minutes',
                'setup_min_installers',
                'stock_qty',
                'available_stock_qty',
                'delivery_transport_restriction',
            ]
        )
        self.distance_patcher = patch(
            'applications.orders.services.delivery_pricing.calculate_route_distance_km',
            return_value=Decimal('10'),
        )
        self.mock_distance = self.distance_patcher.start()

    def tearDown(self):
        self.distance_patcher.stop()
        super().tearDown()

    def _create_order(self, **overrides):
        url = reverse('orders:order-list')
        payload = {
            'installation_date': '2024-06-01',
            'mount_datetime_from': '09:00',
            'mount_datetime_to': '11:00',
            'dismantle_date': '2024-06-05',
            'dismount_datetime_from': '18:00',
            'dismount_datetime_to': '20:00',
            'customer_id': str(self.customer.pk),
            'delivery_type': DeliveryType.DELIVERY,
            'delivery_address': 'Москва, ул. Тестовая, д. 1',
            'comment': 'Проверочный заказ',
            'comment_for_waybill': 'Комментарий для накладной',
            'items': [
                {'product_id': str(self.product.pk), 'quantity': 2, 'rental_days': 1},
            ],
        }
        payload.update(overrides)
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.json()['data']

    def test_create_order(self):
        data = self._create_order()
        self.assertEqual(data['status'], OrderStatus.NEW)
        self.assertEqual(data['payment_status'], PaymentStatus.UNPAID)
        self.assertIsNone(data['logistics_state'])
        self.assertFalse(data['is_warehouse_received'])
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['delivery_type'], DeliveryType.DELIVERY)
        self.assertEqual(data['customer']['id'], str(self.customer.pk))
        self.assertEqual(data['installation_date'], '2024-06-01')
        self.assertEqual(data['mount_datetime_from'], '09:00')
        self.assertEqual(data['mount_datetime_to'], '11:00')
        self.assertEqual(data['dismantle_date'], '2024-06-05')
        self.assertEqual(data['dismount_datetime_from'], '18:00')
        self.assertEqual(data['dismount_datetime_to'], '20:00')
        self.assertGreater(float(data['total_amount']), 0)
        self.assertAlmostEqual(float(data['services_total_amount']), 3900.0, places=2)
        self.assertAlmostEqual(float(data['installation_total_amount']), 2400.0, places=2)
        self.assertAlmostEqual(float(data['dismantle_total_amount']), 1200.0, places=2)
        self.assertAlmostEqual(float(data['delivery_total_amount']), 300.0, places=2)
        self.assertEqual(data['comment_for_waybill'], 'Комментарий для накладной')
        item = data['items'][0]
        self.assertEqual(item['rental_days'], 1)
        self.assertEqual(item['rental_mode'], 'standard')
        self.assertIsNone(item['rental_tiers'])
        self.assertAlmostEqual(float(item['unit_price']), 2700.0, places=2)
        self.assertAlmostEqual(float(data['total_amount']), 9300.0, places=2)

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_stock_qty, 8)

    def test_delivery_cost_scales_with_volume(self):
        data = self._create_order(
            items=[{'product_id': str(self.product.pk), 'quantity': 4, 'rental_days': 1}]
        )
        self.assertAlmostEqual(float(data['delivery_total_amount']), 450.0, places=2)
        self.assertAlmostEqual(float(data['services_total_amount']), 4050.0, places=2)

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
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(url, {'status_group': 'archived'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['status'], OrderStatus.ARCHIVED)
        self.assertEqual(data[0]['payment_status'], PaymentStatus.UNPAID)

    def test_create_pickup_order_without_address_and_comment(self):
        payload = {
            'installation_date': '2024-07-10',
            'dismantle_date': '2024-07-12',
            'delivery_type': DeliveryType.PICKUP,
            'delivery_address': '',
            'comment': '',
            'comment_for_waybill': '',
            'items': [{'product_id': str(self.product.pk), 'quantity': 3, 'rental_days': 1}],
        }

        data = self._create_order(**payload)
        self.assertEqual(data['delivery_type'], DeliveryType.PICKUP)
        self.assertEqual(data['delivery_address'], '')
        self.assertEqual(data['comment'], '')
        self.assertEqual(data['comment_for_waybill'], '')
        self.assertIn('services_total_amount', data)
        self.assertIn('installation_total_amount', data)
        self.assertIn('dismantle_total_amount', data)
        self.assertIn('delivery_total_amount', data)

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
        self.assertAlmostEqual(float(data['total_amount']), 12550.0, places=2)

    def test_validate_address_updates_order_fields(self):
        order_data = self._create_order()
        order_id = order_data['id']
        url = reverse('orders:orders-validate-address', args=[order_id])
        with patch('applications.orders.views.geocode_address') as geocode_mock:
            geocode_mock.return_value = {
                'normalized': 'Россия, Москва, Красная площадь, 1',
                'lat': 55.7539,
                'lon': 37.6208,
                'kind': 'house',
                'precision': 'exact',
                'uri': 'ymapsbm1://geo?where=some-uri',
            }
            response = self.client.post(url, {'input': 'Красная площадь, 1'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertTrue(payload['exists'])
        self.assertEqual(payload['normalized'], 'Россия, Москва, Красная площадь, 1')
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.delivery_address_input, 'Красная площадь, 1')
        self.assertEqual(order.delivery_address_full, 'Россия, Москва, Красная площадь, 1')
        self.assertEqual(order.delivery_address_kind, 'house')
        self.assertEqual(order.delivery_address_precision, 'exact')
        self.assertEqual(order.yandex_uri, 'ymapsbm1://geo?where=some-uri')
        self.assertEqual(order.delivery_lat, Decimal('55.7539'))
        self.assertEqual(order.delivery_lon, Decimal('37.6208'))

    def test_validate_address_requires_input(self):
        order_data = self._create_order()
        url = reverse('orders:orders-validate-address', args=[order_data['id']])

        response = self.client.post(url, {'input': '   '}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payload = response.json()
        self.assertFalse(payload['ok'])
        self.assertEqual(payload['reason'], 'empty')
        self.assertEqual(payload['message'], 'Укажите адрес для валидации.')

    @override_settings(GEOSUGGEST_KEY='test-geosuggest-key')
    def test_yandex_suggest_proxies_response(self):
        url = reverse('orders:ymaps-suggest')
        payload = {
            'results': [{'title': {'text': 'Москва'}, 'address': {'formatted_address': 'Москва'}}]
        }

        mock_response = Mock()
        mock_response.ok = True
        mock_response.status_code = status.HTTP_200_OK
        mock_response.json.return_value = payload

        with patch(
            'applications.orders.views.requests.get', return_value=mock_response
        ) as mock_get:
            response = self.client.get(url, {'q': 'Москва'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), payload)

        self.assertTrue(mock_get.called)
        _, kwargs = mock_get.call_args
        params = kwargs['params']
        self.assertEqual(params['apikey'], 'test-geosuggest-key')
        self.assertEqual(params['text'], 'Москва')
        self.assertEqual(params['lang'], 'ru_RU')
        self.assertEqual(params['types'], 'geo')

    @override_settings(GEOSUGGEST_KEY='test-geosuggest-key')
    def test_yandex_suggest_skips_empty_query(self):
        url = reverse('orders:ymaps-suggest')
        with patch('applications.orders.views.requests.get') as mock_get:
            response = self.client.get(url, {'q': '   '})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {'results': []})
        mock_get.assert_not_called()

    def test_orders_with_coords_returns_only_geocoded_orders(self):
        order_data = self._create_order()
        order = Order.objects.get(pk=order_data['id'])
        order.delivery_address_input = 'Тверская улица, 1'
        order.delivery_address_full = 'Россия, Москва, Тверская улица, 1'
        order.delivery_lat = Decimal('55.7570')
        order.delivery_lon = Decimal('37.6150')
        order.delivery_address_kind = 'house'
        order.delivery_address_precision = 'exact'
        order.save()

        other = self._create_order(delivery_address='Санкт-Петербург, Невский проспект, 1')
        Order.objects.filter(pk=other['id']).update(
            delivery_address_input='Санкт-Петербург, Невский проспект, 1'
        )

        url = reverse('orders:orders-with-coords')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.json()['items']
        self.assertEqual(len(items), 1)
        entry = items[0]
        self.assertEqual(entry['id'], order.pk)
        self.assertEqual(entry['address'], 'Россия, Москва, Тверская улица, 1')
        self.assertAlmostEqual(entry['lat'], 55.7570, places=4)
        self.assertAlmostEqual(entry['lon'], 37.6150, places=4)
        self.assertTrue(entry['exact'])
        self.assertIsNone(entry['driver'])
        self.assertEqual(entry['installation_date'], order.installation_date.isoformat())
        self.assertEqual(entry['mount_datetime_from'], order.mount_datetime_from.strftime('%H:%M'))
        self.assertEqual(entry['mount_datetime_to'], order.mount_datetime_to.strftime('%H:%M'))
        self.assertEqual(entry['dismantle_date'], order.dismantle_date.isoformat())
        self.assertEqual(
            entry['dismount_datetime_from'], order.dismount_datetime_from.strftime('%H:%M')
        )
        self.assertEqual(
            entry['dismount_datetime_to'], order.dismount_datetime_to.strftime('%H:%M')
        )

    def test_orders_with_coords_includes_driver(self):
        order_data = self._create_order()
        order = Order.objects.get(pk=order_data['id'])
        order.delivery_address_input = 'Санкт-Петербург, Невский проспект, 10'
        order.delivery_address_full = 'Россия, Санкт-Петербург, Невский проспект, 10'
        order.delivery_lat = Decimal('59.9343')
        order.delivery_lon = Decimal('30.3351')
        order.save()

        OrderDriver.objects.create(order=order, full_name='Алексей Смирнов', phone='+79995556677')

        url = reverse('orders:orders-with-coords')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.json()['items']
        self.assertEqual(len(items), 1)
        entry = items[0]
        self.assertIsNotNone(entry['driver'])
        self.assertEqual(entry['driver']['full_name'], 'Алексей Смирнов')
        self.assertEqual(entry['driver']['phone'], '+79995556677')
        self.assertEqual(entry['installation_date'], order.installation_date.isoformat())
        self.assertEqual(entry['dismantle_date'], order.dismantle_date.isoformat())

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
        # unit price 2700 * (1 + 2) = 8100, услуги по сетапу зависят от общего времени
        self.assertAlmostEqual(float(data['total_amount']), 13800.0, places=2)
        self.assertAlmostEqual(float(data['services_total_amount']), 5700.0, places=2)
        self.assertAlmostEqual(float(data['installation_total_amount']), 3600.0, places=2)
        self.assertAlmostEqual(float(data['dismantle_total_amount']), 1800.0, places=2)

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
        self.assertAlmostEqual(float(data['total_amount']), 9300.0, places=2)
        self.assertAlmostEqual(float(data['services_total_amount']), 3900.0, places=2)
        self.assertAlmostEqual(float(data['installation_total_amount']), 2400.0, places=2)
        self.assertAlmostEqual(float(data['dismantle_total_amount']), 1200.0, places=2)
        self.assertAlmostEqual(float(data['delivery_total_amount']), 300.0, places=2)
        self.assertIn('items', data)
        self.assertEqual(len(data['items']), 1)
        self.assertIsNotNone(data['delivery_pricing'])
        self.assertEqual(data['delivery_pricing']['transport_count'], 2)

    def test_update_payment_status_and_filter(self):
        create_url = reverse('orders:orders-list')
        payload = {
            'installation_date': '2024-06-01',
            'dismantle_date': '2024-06-05',
            'items': [{'product_id': str(self.product.pk), 'quantity': 1, 'rental_days': 1}],
        }
        order_id = self.client.post(create_url, payload, format='json').json()['data']['id']

        patch_url = reverse('orders:orders-update-payment-status', args=[order_id])
        response = self.client.patch(
            patch_url,
            {'payment_status': PaymentStatus.PAID},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']
        self.assertEqual(data['payment_status'], PaymentStatus.PAID)
        self.assertEqual(data['payment_status_label'], 'Оплачен')

        list_url = reverse('orders:orders-list')
        response = self.client.get(list_url, {'payment_status': [PaymentStatus.PAID]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['id'], order_id)

    def test_logistics_state_flow_and_receive(self):
        create_url = reverse('orders:orders-list')
        payload = {
            'installation_date': '2024-06-10',
            'dismantle_date': '2024-06-12',
            'items': [{'product_id': str(self.product.pk), 'quantity': 1, 'rental_days': 1}],
        }
        order_data = self.client.post(create_url, payload, format='json').json()['data']
        order_id = order_data['id']

        update_url = reverse('orders:orders-detail', args=[order_id])
        response = self.client.patch(
            update_url,
            {
                'logistics_state': LogisticsState.SHIPPED,
                'shipment_date': '2024-06-15',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        updated = response.json()['data']
        self.assertEqual(updated['logistics_state'], LogisticsState.SHIPPED)
        self.assertEqual(updated['shipment_date'], '2024-06-15')

        list_url = reverse('orders:orders-list')
        response = self.client.get(list_url, {'logistics_state': [LogisticsState.SHIPPED]})
        self.assertEqual(len(response.json()['data']), 1)

    def test_search_orders_by_customer_details(self):
        self._create_order()
        other_customer = Customer.objects.create(
            display_name='Анна Иванова',
            phone='+7 (999) 123-45-67',
        )
        matched_order = self._create_order(customer_id=str(other_customer.pk))

        list_url = reverse('orders:orders-list')

        response = self.client.get(list_url, {'q': 'Анна', 'search': 'Анна'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], matched_order['id'])

        phone_query = '9991234567'
        response = self.client.get(list_url, {'q': phone_query, 'search': phone_query})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], matched_order['id'])

    def test_assign_driver_creates_and_updates(self):
        order_data = self._create_order()
        order_id = order_data['id']
        url = reverse('orders:orders-assign-driver', args=[order_id])

        response = self.client.post(
            url,
            {'full_name': 'Иван Петров', 'phone': '+7 (999) 111-22-33'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()['data']
        self.assertEqual(payload['full_name'], 'Иван Петров')
        self.assertEqual(payload['phone'], '+79991112233')
        driver = OrderDriver.objects.get(order_id=order_id)
        self.assertEqual(driver.full_name, 'Иван Петров')
        self.assertEqual(driver.phone, '+79991112233')

        response = self.client.post(
            url,
            {'full_name': 'Александр Иванов', 'phone': '+7 (999) 444-55-66'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()['data']
        self.assertEqual(payload['full_name'], 'Александр Иванов')
        self.assertEqual(payload['phone'], '+79994445566')
        driver.refresh_from_db()
        self.assertEqual(driver.full_name, 'Александр Иванов')
        self.assertEqual(driver.phone, '+79994445566')

        receive_url = reverse('orders:orders-receive', args=[order_id])
        response = self.client.post(receive_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        received_data = response.json()['data']
        self.assertTrue(received_data['is_warehouse_received'])
        self.assertIsNotNone(received_data['warehouse_received_at'])
        self.assertEqual(received_data['warehouse_received_by'], self.user.pk)

        # idempotent call
        response = self.client.post(receive_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        received_again = response.json()['data']
        self.assertEqual(
            received_data['warehouse_received_at'], received_again['warehouse_received_at']
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.json()['data']), 1)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()['data']), 0)

    def test_remove_driver_is_idempotent(self):
        order_data = self._create_order()
        order_id = order_data['id']
        url = reverse('orders:orders-assign-driver', args=[order_id])

        response = self.client.post(
            url,
            {'full_name': 'Иван Петров', 'phone': '+7 (999) 111-22-33'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(OrderDriver.objects.filter(order_id=order_id).exists())

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(OrderDriver.objects.filter(order_id=order_id).exists())

        # deleting again should remain idempotent
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

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

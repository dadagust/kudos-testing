"""End-to-end tests for the products API contract."""

from __future__ import annotations

from io import BytesIO
from uuid import UUID

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils.text import slugify
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from applications.products.choices import DimensionShape, RentalMode, ReservationMode
from applications.products.models import (
    Category,
    Color,
    InstallerQualification,
    Product,
    ProductGroup,
    TransportRestriction,
)


class ProductApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username='admin@example.com',
            email='admin@example.com',
            password='ChangeMe123!',
        )
        self.client.force_authenticate(self.user)
        self.category = Category.objects.create(name='Текстиль', slug='textile')
        self.installer_qualification = InstallerQualification.objects.create(
            name='Только «Работник с парогенератором»',
            price_rub='1500.00',
        )
        Color.objects.create(value='white', label='Белый')
        TransportRestriction.objects.create(value='any', label='Любой')
        TransportRestriction.objects.create(value='truck_only', label='Только грузовой')

    def _create_payload(self):
        return {
            'name': 'Скатерть Амори бархатная молочная круглая',
            'features': [
                'Возможно увеличение количества по предзаказу.',
                'Глажка только с изнаночной стороны.',
            ],
            'category_id': str(self.category.id),
            'price_rub': '2700',
            'loss_compensation_rub': '9000',
            'color': 'white',
            'dimensions': {
                'shape': DimensionShape.CIRCLE_DIAMETER,
                'circle': {'diameter_cm': '330'},
            },
            'delivery': {
                'volume_cm3': 3500,
                'weight_kg': '2.0',
                'transport_restriction': 'any',
                'self_pickup_allowed': True,
            },
            'occupancy': {'cleaning_days': 1},
            'setup': {
                'install_minutes': 20.5,
                'uninstall_minutes': 10.25,
                'installer_qualification': str(self.installer_qualification.id),
                'min_installers': 1,
                'self_setup_allowed': True,
            },
            'rental': {
                'mode': RentalMode.SPECIAL,
                'tiers': [
                    {'end_day': 3, 'price_per_day': '2500.00'},
                    {'end_day': 7, 'price_per_day': '2200.00'},
                ],
            },
            'visibility': {
                'reservation_mode': ReservationMode.OPERATOR_ONLY,
                'show_on_pifakit': True,
                'show_on_site': True,
                'show_in_new': True,
                'category_cover_on_home': False,
            },
            'seo': {
                'meta_title': 'Скатерть Амори — молочная, круглая',
                'meta_description': 'Качественная бархатная скатерть',
            },
        }

    def test_create_and_retrieve_product(self):
        url = reverse('products:product-list')
        payload = self._create_payload()

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertIn('id', body)
        product_id = UUID(body['id'])

        detail_url = (
            reverse('products:product-detail', args=[product_id]) + '?include=images,seo,dimensions'
        )
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        product = response.json()
        self.assertEqual(product['name'], payload['name'])
        self.assertEqual(product['dimensions']['shape'], payload['dimensions']['shape'])
        expected_url_name = slugify(payload['name'], allow_unicode=True)
        self.assertEqual(product['seo']['url_name'], expected_url_name)
        self.assertIn('created_at', product)
        self.assertIn('updated_at', product)
        self.assertEqual(product['rental']['mode'], RentalMode.SPECIAL)
        self.assertEqual(len(product['rental']['tiers']), 2)
        self.assertEqual(product['rental']['tiers'][0]['end_day'], 3)
        self.assertAlmostEqual(
            product['setup']['install_minutes'], payload['setup']['install_minutes']
        )
        self.assertAlmostEqual(
            product['setup']['uninstall_minutes'], payload['setup']['uninstall_minutes']
        )

    def test_list_with_filters_and_cursor(self):
        product = Product.objects.create(
            name='Стул',
            category=self.category,
            price_rub='1200',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=100,
            delivery_weight_kg='1.00',
        )
        product.delivery_self_pickup_allowed = True
        product.delivery_transport_restriction_id = 'truck_only'
        product.delivery_volume_cm3 = 10
        product.stock_qty = 15
        product.available_stock_qty = 10
        product.save()

        url = reverse('products:product-list')
        response = self.client.get(url, {'limit': 1, 'color': '', 'include': 'seo'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn('results', body)
        self.assertIsNotNone(body['next_cursor'])
        self.assertIn('totals', body)
        self.assertEqual(body['totals']['positions'], 1)
        self.assertEqual(body['totals']['total_stock_qty'], 15)
        self.assertEqual(body['totals']['available_stock_qty'], 10)
        self.assertEqual(body['totals']['reserved_stock_qty'], 5)
        item = body['results'][0]
        self.assertEqual(item['id'], str(product.id))
        self.assertIn('delivery', item)
        self.assertIn('seo', item)

    def test_list_totals_calculated_for_full_queryset(self):
        first = Product.objects.create(
            name='Стол',
            category=self.category,
            price_rub='3200',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=120,
            delivery_weight_kg='5.00',
            stock_qty=20,
            available_stock_qty=14,
        )
        second = Product.objects.create(
            name='Стул',
            category=self.category,
            price_rub='900',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=80,
            delivery_weight_kg='2.00',
            stock_qty=5,
            available_stock_qty=2,
        )

        response = self.client.get(
            reverse('products:product-list'), {'limit': 1, 'ordering': 'name'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        totals = response.json()['totals']
        self.assertEqual(totals['positions'], 2)
        self.assertEqual(totals['total_stock_qty'], first.stock_qty + second.stock_qty)
        self.assertEqual(
            totals['available_stock_qty'], first.available_stock_qty + second.available_stock_qty
        )
        self.assertEqual(totals['reserved_stock_qty'], 9)

    def test_category_tree_and_enums(self):
        child = Category.objects.create(name='Скатерти', slug='skater', parent=self.category)
        response = self.client.get(reverse('products:product-categories'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tree = response.json()
        self.assertEqual(len(tree), 1)
        self.assertEqual(tree[0]['id'], str(self.category.id))
        self.assertEqual(len(tree[0]['children']), 1)
        self.assertEqual(tree[0]['children'][0]['id'], str(child.id))

        response = self.client.get(reverse('products:product-enums'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        enums = response.json()
        self.assertIn('colors', enums)
        self.assertIn('shapes', enums)
        installer_qualifications = enums.get('installer_qualifications', [])
        self.assertTrue(
            any(
                item['value'] == str(self.installer_qualification.id)
                for item in installer_qualifications
            )
        )

    def test_category_items_return_groups_and_unique_products(self):
        grouped_product = Product.objects.create(
            name='Стул в группе',
            category=self.category,
            price_rub='1800',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=75,
            delivery_weight_kg='1.25',
        )
        standalone_product = Product.objects.create(
            name='Стол без группы',
            category=self.category,
            price_rub='3200',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=120,
            delivery_weight_kg='4.00',
        )
        group = ProductGroup.objects.create(name='Гостиный комплект', category=self.category)
        group.products.add(grouped_product)

        url = reverse('products:product-category-items')
        response = self.client.get(url, {'category_id': str(self.category.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()['data']
        self.assertEqual(len(payload), 2)

        group_payload = next(item for item in payload if item['item_type'] == 'group')
        product_payload = next(item for item in payload if item['item_type'] == 'product')

        self.assertEqual(group_payload['id'], str(group.id))
        self.assertEqual(len(group_payload['products']), 1)
        self.assertEqual(group_payload['products'][0]['id'], str(grouped_product.id))
        self.assertEqual(product_payload['id'], str(standalone_product.id))
        self.assertNotEqual(product_payload['id'], str(grouped_product.id))

    def test_new_items_return_groups_and_unique_products(self):
        grouped_product = Product.objects.create(
            name='Стул в новинках',
            category=self.category,
            price_rub='1800',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=75,
            delivery_weight_kg='1.25',
            visibility_show_in_new=True,
        )
        standalone_product = Product.objects.create(
            name='Стол в новинках',
            category=self.category,
            price_rub='3200',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=120,
            delivery_weight_kg='4.00',
            visibility_show_in_new=True,
        )
        Product.objects.create(
            name='Стол не новинка',
            category=self.category,
            price_rub='2500',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=100,
            delivery_weight_kg='3.00',
        )
        group = ProductGroup.objects.create(
            name='Гостиный комплект новинки',
            category=self.category,
            show_in_new=True,
        )
        group.products.add(grouped_product)

        url = reverse('products:product-new-items')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()['data']
        self.assertEqual(len(payload), 2)

        group_payload = next(item for item in payload if item['item_type'] == 'group')
        product_payload = next(item for item in payload if item['item_type'] == 'product')

        self.assertEqual(group_payload['id'], str(group.id))
        self.assertEqual(len(group_payload['products']), 1)
        self.assertEqual(group_payload['products'][0]['id'], str(grouped_product.id))
        self.assertEqual(product_payload['id'], str(standalone_product.id))
        self.assertNotEqual(product_payload['id'], str(grouped_product.id))

    def test_public_catalogue_endpoint(self):
        image_content = BytesIO()
        image = Image.new('RGB', (50, 50), color='blue')
        image.save(image_content, format='PNG')
        image_content.seek(0)

        uploaded = SimpleUploadedFile(
            'category.png', image_content.read(), content_type='image/png'
        )
        category = Category.objects.create(
            name='Свет', slug='light', image=uploaded
        )

        response = self.client.get(reverse('catalogue-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payload = response.json().get('data', [])
        self.assertGreaterEqual(len(payload), 1)
        target = next((item for item in payload if item['id'] == str(category.id)), None)

        self.assertIsNotNone(target)
        self.assertEqual(target['name'], category.name)
        self.assertEqual(target['slug'], category.slug)
        self.assertTrue(target['image'])
        self.assertTrue(target['image'].startswith('http://testserver/media/'))

    def test_image_upload_and_reorder(self):
        product = Product.objects.create(
            name='Фон',
            category=self.category,
            price_rub='5000',
            dimensions_shape=DimensionShape.BOX_HEIGHT_WIDTH_DEPTH,
            box_height_cm=10,
            box_width_cm=10,
            box_depth_cm=10,
            delivery_volume_cm3=1000,
            delivery_weight_kg='2.00',
        )

        image_content = BytesIO()
        image = Image.new('RGB', (10, 10), color='red')
        image.save(image_content, format='PNG')
        image_content.seek(0)
        upload = SimpleUploadedFile('test.png', image_content.read(), content_type='image/png')

        url = reverse('products:product-upload-images', args=[product.id])
        response = self.client.post(url, {'files': [upload]}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(len(data), 1)
        image_id = data[0]['id']

        reorder_url = reverse('products:product-reorder-images', args=[product.id])
        response = self.client.patch(
            reorder_url, {'order': [{'id': image_id, 'position': 2}]}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        delete_url = reverse('products:product-delete-image', args=[product.id, image_id])
        response = self.client.delete(delete_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_stock_transactions_endpoint(self):
        product = Product.objects.create(
            name='Фонарь',
            category=self.category,
            price_rub='1500',
            dimensions_shape=DimensionShape.LINE_LENGTH,
            line_length_cm=50,
            delivery_weight_kg='0.50',
        )

        url = reverse('products:product-transactions', args=[product.id])
        payload = {
            'quantity_delta': 5,
            'affects_available': True,
            'note': 'Поступление партии',
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transaction = response.json()
        self.assertEqual(transaction['quantity_delta'], 5)
        self.assertTrue(transaction['affects_available'])
        self.assertEqual(transaction['created_by'], self.user.id)
        self.assertEqual(transaction['created_by_name'], 'admin@example.com')

        product.refresh_from_db()
        self.assertEqual(product.stock_qty, 5)
        self.assertEqual(product.available_stock_qty, 5)

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['id'], transaction['id'])
        self.assertEqual(items[0]['created_by'], self.user.id)
        self.assertEqual(items[0]['created_by_name'], 'admin@example.com')

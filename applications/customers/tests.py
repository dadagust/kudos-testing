from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from applications.core.models import RoleChoices

from .models import Address, Company, Contact, Customer


class CustomerAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.manager = get_user_model().objects.create_user(
            username='manager@example.com',
            email='manager@example.com',
            password='ChangeMe123!',
            first_name='Марина',
        )
        manager_profile = cls.manager.profile
        manager_profile.role = RoleChoices.SALES_MANAGER
        manager_profile.save()

        cls.customer_user = get_user_model().objects.create_user(
            username='client@example.com',
            email='client@example.com',
            password='ChangeMe123!',
            first_name='Анна',
        )
        customer_profile = cls.customer_user.profile
        customer_profile.role = RoleChoices.CUSTOMER
        customer_profile.save()

        cls.b2b_user = get_user_model().objects.create_user(
            username='b2b@example.com',
            email='b2b@example.com',
            password='ChangeMe123!',
            first_name='Сергей',
        )
        b2b_profile = cls.b2b_user.profile
        b2b_profile.role = RoleChoices.B2B
        b2b_profile.save()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_sales_manager_can_create_customer(self):
        self.authenticate(self.manager)
        payload = {
            'first_name': 'Иван',
            'last_name': 'Петров',
            'email': 'ivan.petrov@example.com',
            'phone': '+7 (999) 123-45-67',
            'customer_type': 'individual',
            'tags': ['VIP', 'Москва'],
            'gdpr_consent': True,
            'marketing_consent': False,
            'company': {
                'name': 'Event Lab',
                'legal_name': 'ООО «Ивент Лаб»',
                'inn': '7701234567',
            },
            'addresses': [
                {
                    'title': 'Основной',
                    'city': 'Москва',
                    'street': 'Тверская',
                    'building': '1',
                    'postal_code': '125009',
                    'address_type': 'shipping',
                    'is_primary': True,
                }
            ],
            'contacts': [
                {
                    'name': 'Мария Соколова',
                    'email': 'm.sokolova@example.com',
                    'phone': '+7 495 111 22 33',
                    'is_primary': True,
                }
            ],
        }
        response = self.client.post('/api/v1/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['email'], 'ivan.petrov@example.com')
        self.assertEqual(data['phone'], '+79991234567')
        self.assertEqual(data['owner'], self.manager.id)
        self.assertEqual(len(data['addresses']), 1)
        self.assertEqual(len(data['contacts']), 1)

        customer = Customer.objects.get(pk=data['id'])
        self.assertTrue(customer.company)
        self.assertEqual(customer.company.name, 'Event Lab')
        self.assertTrue(Address.objects.filter(customer=customer, is_active=True).exists())
        self.assertTrue(Contact.objects.filter(customer=customer, is_active=True).exists())

    def test_duplicate_email_is_rejected(self):
        self.authenticate(self.manager)
        Customer.objects.create(
            first_name='Алексей',
            last_name='Смирнов',
            email='alex@example.com',
            phone='+79990000001',
            customer_type='individual',
            owner=self.manager,
        )

        payload = {
            'first_name': 'Алексей',
            'last_name': 'Смирнов',
            'email': 'ALEX@example.com',
            'phone': '+79990000002',
            'customer_type': 'individual',
        }
        response = self.client.post('/api/v1/customers/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.json())

    def test_customer_role_sees_only_own_profile(self):
        owner_one = self.customer_user
        owner_two = self.manager

        first = Customer.objects.create(
            first_name='Мария',
            last_name='Иванова',
            email='maria@example.com',
            phone='+79991234568',
            customer_type='individual',
            owner=owner_one,
        )
        Customer.objects.create(
            first_name='Олег',
            last_name='Сидоров',
            email='oleg@example.com',
            phone='+79991234569',
            customer_type='individual',
            owner=owner_two,
        )

        self.authenticate(self.customer_user)
        response = self.client.get('/api/v1/customers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        if isinstance(data, dict) and 'results' in data:
            results = data['results']
        else:
            results = data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], first.id)

    def test_soft_delete_marks_customer_inactive(self):
        self.authenticate(self.manager)
        customer = Customer.objects.create(
            first_name='Удаляемый',
            last_name='Клиент',
            email='remove@example.com',
            phone='+79990000003',
            customer_type='individual',
            owner=self.manager,
        )

        response = self.client.delete(f'/api/v1/customers/{customer.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        customer.refresh_from_db()
        self.assertFalse(customer.is_active)

        list_response = self.client.get('/api/v1/customers/')
        payload = list_response.json()
        self.assertEqual(payload['count'], 0)

    def test_filtering_by_search_and_tag(self):
        self.authenticate(self.manager)
        company = Company.objects.create(name='Agency', owner=self.manager)
        Customer.objects.create(
            first_name='Илья',
            last_name='Новиков',
            email='ilya@example.com',
            phone='+79990000010',
            customer_type='corporate',
            owner=self.manager,
            company=company,
            tags=['vip'],
        )
        second = Customer.objects.create(
            first_name='Антон',
            last_name='Поляков',
            email='anton@example.com',
            phone='+79990000011',
            customer_type='individual',
            owner=self.manager,
            tags=['test'],
        )

        response = self.client.get('/api/v1/customers/', {'q': 'Илья'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['count'], 1)

        response = self.client.get('/api/v1/customers/', {'tag': 'vip'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['count'], 1)

        response = self.client.get('/api/v1/customers/', {'company_id': company.id})
        self.assertEqual(response.json()['count'], 1)

        response = self.client.get('/api/v1/customers/', {'tag': 'test'})
        self.assertEqual(response.json()['results'][0]['id'], second.id)

    def test_b2b_user_can_update_own_customer(self):
        customer = Customer.objects.create(
            first_name='B2B',
            last_name='Client',
            email='b2b-client@example.com',
            phone='+79990000012',
            customer_type='corporate',
            owner=self.b2b_user,
        )

        self.authenticate(self.b2b_user)
        response = self.client.patch(
            f'/api/v1/customers/{customer.id}/',
            {'phone': '+7 (999) 000-00-13'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertEqual(customer.phone, '+79990000013')

        other = Customer.objects.create(
            first_name='Other',
            last_name='Client',
            email='other@example.com',
            phone='+79990000014',
            customer_type='individual',
            owner=self.manager,
        )
        response = self.client.patch(
            f'/api/v1/customers/{other.id}/',
            {'phone': '+79990000015'},
            format='json',
        )
        self.assertIn(response.status_code, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND})

    def test_contacts_subresource_allows_listing_and_creation(self):
        customer = Customer.objects.create(
            first_name='Марина',
            last_name='Гранкина',
            email='marina@example.com',
            phone='+79990000020',
            customer_type='individual',
            owner=self.manager,
        )
        Contact.objects.create(
            customer=customer,
            name='Существующий контакт',
            email='contact@example.com',
            phone='+79990000021',
            is_primary=True,
        )

        self.authenticate(self.manager)
        list_response = self.client.get(f'/api/v1/customers/{customer.id}/contacts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.json()), 1)

        payload = {
            'name': 'Новый контакт',
            'email': 'new.contact@example.com',
            'phone': '+7 (999) 000-00-22',
            'is_primary': False,
        }
        create_response = self.client.post(
            f'/api/v1/customers/{customer.id}/contacts/',
            payload,
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        data = create_response.json()
        self.assertEqual(data['name'], 'Новый контакт')
        self.assertEqual(Contact.objects.filter(customer=customer).count(), 2)

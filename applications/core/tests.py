from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from rest_framework import serializers, status
from rest_framework.test import APITestCase

from .models import RoleChoices, UserProfile
from .rbac import ROLE_GROUP_MAP, ROLE_PERMISSION_MATRIX


class AuthTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='manager@kudos.ru',
            email='manager@kudos.ru',
            password='ChangeMe123!',
            first_name='Ирина',
        )
        UserProfile.objects.update_or_create(user=self.user, defaults={'role': RoleChoices.SALES_MANAGER})

    def test_ping(self):
        response = self.client.get(reverse('ping'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'ok')

    def test_login_success(self):
        response = self.client.post(
            reverse('auth-login'), {'email': 'manager@kudos.ru', 'password': 'ChangeMe123!'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)
        self.assertEqual(data['user']['role'], RoleChoices.SALES_MANAGER)

    def test_login_fail(self):
        response = self.client.post(
            reverse('auth-login'), {'email': 'manager@kudos.ru', 'password': 'wrong'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_handles_database_errors(self):
        user_model = get_user_model()
        with patch.object(user_model.objects, 'get', side_effect=OperationalError('db down')):
            serializer = LoginSerializer(data={'email': 'user@example.com', 'password': 'secret'})
            with self.assertRaises(serializers.ValidationError) as exc:
                serializer.is_valid(raise_exception=True)

        self.assertIn('Сервис авторизации временно недоступен', str(exc.exception))

    def test_me_requires_auth(self):
        response = self.client.get(reverse('auth-me'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_profile(self):
        login = self.client.post(
            reverse('auth-login'), {'email': 'manager@kudos.ru', 'password': 'ChangeMe123!'}
        )
        token = login.json()['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(reverse('auth-me'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['email'], 'manager@kudos.ru')
        self.assertEqual(data['role'], RoleChoices.SALES_MANAGER)


class RolePermissionsTests(TestCase):
    def test_role_groups_exist(self):
        for group_name in ROLE_GROUP_MAP.values():
            with self.subTest(group=group_name):
                self.assertTrue(Group.objects.filter(name=group_name).exists())

    def test_staff_flag_changes_with_role(self):
        user = get_user_model().objects.create_user(
            username='user@example.com', email='user@example.com', password='ChangeMe123!'
        )
        profile = user.profile

        profile.role = RoleChoices.CUSTOMER
        profile.save()
        user.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertTrue(user.groups.filter(name=ROLE_GROUP_MAP[RoleChoices.CUSTOMER]).exists())

        profile.role = RoleChoices.SALES_MANAGER
        profile.save()
        user.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertTrue(user.groups.filter(name=ROLE_GROUP_MAP[RoleChoices.SALES_MANAGER]).exists())

    def test_group_permissions_match_matrix(self):
        for group_name, permission_map in ROLE_PERMISSION_MATRIX.items():
            if group_name == 'Admin':
                # Admin receives all permissions; skip strict comparison.
                continue
            with self.subTest(group=group_name):
                group = Group.objects.get(name=group_name)
                for (app_label, model), actions in permission_map.items():
                    for action in actions:
                        codename = f"{action}_{model}"
                        self.assertTrue(
                            group.permissions.filter(
                                codename=codename, content_type__app_label=app_label
                            ).exists(),
                            msg=f"{group_name} missing {codename} for {app_label}",
                        )

    def test_admin_access_blocked_for_non_staff(self):
        user = get_user_model().objects.create_user(
            username='customer@example.com', email='customer@example.com', password='ChangeMe123!'
        )
        profile = user.profile
        profile.role = RoleChoices.CUSTOMER
        profile.save()

        client = self.client
        client.force_login(user)
        response = client.get(reverse('admin:index'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/login/', response.url)

    def test_admin_access_allowed_for_staff(self):
        user = get_user_model().objects.create_user(
            username='manager@example.com', email='manager@example.com', password='ChangeMe123!'
        )
        profile = user.profile
        profile.role = RoleChoices.SALES_MANAGER
        profile.save()

        client = self.client
        client.force_login(user)
        response = client.get(reverse('admin:index'))
        self.assertEqual(response.status_code, 200)

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import RoleChoices, UserProfile


class AuthTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="manager@kudos.ru",
            email="manager@kudos.ru",
            password="ChangeMe123!",
            first_name="Ирина",
        )
        UserProfile.objects.update_or_create(user=self.user, defaults={"role": RoleChoices.MANAGER})

    def test_ping(self):
        response = self.client.get(reverse("ping"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "ok")

    def test_login_success(self):
        response = self.client.post(reverse("auth-login"), {"email": "manager@kudos.ru", "password": "ChangeMe123!"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertEqual(data["user"]["role"], RoleChoices.MANAGER)

    def test_login_fail(self):
        response = self.client.post(reverse("auth-login"), {"email": "manager@kudos.ru", "password": "wrong"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_requires_auth(self):
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_profile(self):
        login = self.client.post(reverse("auth-login"), {"email": "manager@kudos.ru", "password": "ChangeMe123!"})
        token = login.json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["email"], "manager@kudos.ru")
        self.assertEqual(data["role"], RoleChoices.MANAGER)

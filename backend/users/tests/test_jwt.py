from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class JWTAuthenticationTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='ana', password='example-password'
        )

    def test_access_token_authenticates_api_and_refresh_renews_it(self):
        """Use JWT access and refresh tokens for protected routes."""
        response = self.client.post(
            reverse('token-obtain'),
            {'username': 'ana', 'password': 'example-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)
        self.assertEqual(
            self.client.post(
                reverse('tasks:list'), {'title': 'Team task'}, format='json'
            ).status_code,
            201,
        )

        self.client.credentials()
        refreshed = self.client.post(
            reverse('token-refresh'), {'refresh': response.data['refresh']},
            format='json',
        )
        self.assertEqual(refreshed.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {refreshed.data["access"]}'
        )
        self.assertEqual(self.client.get(reverse('tasks:list')).data['count'], 1)

    def test_bad_credentials_and_invalid_token_are_rejected(self):
        """Reject bad passwords and invalid access tokens."""
        response = self.client.post(
            reverse('token-obtain'),
            {'username': 'ana', 'password': 'wrong-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 401)

    def test_session_login_does_not_authenticate_api(self):
        """Require JWT even when a Django session is active."""
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 401)

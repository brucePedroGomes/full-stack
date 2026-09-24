from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.tokens import AccessToken


@override_settings(
    ALLOWED_HOSTS=['testserver'],
    SECURE_SSL_REDIRECT=False,
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'jwt-tests',
        },
    },
)
class JWTAuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='ana', password='example-password'
        )

    def obtain_tokens(self):
        return self.client.post(
            reverse('token-obtain'),
            {'username': 'ana', 'password': 'example-password'},
            format='json',
        )

    def test_login_returns_token_pair(self):
        """Return access and refresh tokens for valid credentials."""
        response = self.obtain_tokens()
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_access_token_authenticates_api(self):
        """Use an access token to read the current user's account."""
        response = self.obtain_tokens()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)

    def test_access_token_allows_task_creation(self):
        """Use an access token to create a task."""
        response = self.obtain_tokens()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        self.assertEqual(
            self.client.post(
                reverse('tasks:list'), {'title': 'Team task'}, format='json'
            ).status_code,
            201,
        )

    def test_refresh_token_renews_access(self):
        """Use a refresh token to get another valid access token."""
        response = self.obtain_tokens()
        refreshed = self.client.post(
            reverse('token-refresh'), {'refresh': response.data['refresh']},
            format='json',
        )
        self.assertEqual(refreshed.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {refreshed.data["access"]}'
        )
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)

    def test_bad_credentials_are_rejected(self):
        """Reject a login attempt with the wrong password."""
        response = self.client.post(
            reverse('token-obtain'),
            {'username': 'ana', 'password': 'wrong-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)

    def test_invalid_access_token_is_rejected(self):
        """Reject an API request with an invalid token."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 401)

    def test_session_login_does_not_authenticate_api(self):
        """Require JWT even when a Django session is active."""
        self.client.force_login(self.user)
        for name in ('users:me', 'users:list', 'tasks:list'):
            with self.subTest(endpoint=name):
                self.assertEqual(self.client.get(reverse(name)).status_code, 401)

    def test_django_secret_cannot_sign_api_tokens(self):
        """Reject a valid token payload signed with the session key."""
        token = AccessToken.for_user(self.user)
        backend = TokenBackend(algorithm='HS256', signing_key=settings.SECRET_KEY)
        wrong_signature = backend.encode(token.payload)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {wrong_signature}')
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 401)

    def test_token_pair_uses_the_separate_jwt_key(self):
        """Both token types use the configured signing key."""
        response = self.obtain_tokens()
        self.assertEqual(response.status_code, 200)
        backend = TokenBackend(
            algorithm='HS256', signing_key=settings.SIMPLE_JWT['SIGNING_KEY']
        )
        for name in ('access', 'refresh'):
            with self.subTest(token=name):
                payload = backend.decode(response.data[name])
                self.assertEqual(payload['user_id'], str(self.user.pk))
                self.assertEqual(payload['token_type'], name)

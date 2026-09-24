from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework.throttling import SimpleRateThrottle


@override_settings(
    ALLOWED_HOSTS=['testserver'],
    SECURE_SSL_REDIRECT=False,
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'rate-limit-tests',
        },
    },
)
class RateLimitTests(APITestCase):
    def setUp(self) -> None:
        self.rate_patch = patch.dict(
            SimpleRateThrottle.THROTTLE_RATES,
            {'anon': '10/min', 'user': '2/min', 'auth': '2/min', 'auth_csr': '2/min'},
        )
        self.rate_patch.start()
        cache.clear()

    def tearDown(self) -> None:
        cache.clear()
        self.rate_patch.stop()

    def test_authenticated_requests_are_limited_per_user(self) -> None:
        """Return 429 after a user's limit, without blocking another user."""
        first = User.objects.create(username='first')
        second = User.objects.create(username='second')
        self.client.force_authenticate(user=first)
        url = reverse('users:me')

        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 200)
        blocked = self.client.get(url)
        self.assertEqual(blocked.status_code, 429)
        self.assertIn('Retry-After', blocked)

        self.client.force_authenticate(user=second)
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_token_requests_share_a_limit_with_browser_login(self) -> None:
        """Count failed browser and JWT logins from the same IP together."""
        browser = Client(enforce_csrf_checks=True)
        browser.get(reverse('browser-csrf'))
        csrf = browser.cookies['csrftoken'].value
        self.assertEqual(
            browser.post(
                reverse('browser-login'), {'username': 'missing', 'password': 'wrong'},
                HTTP_X_CSRFTOKEN=csrf,
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(reverse('token-obtain'), {}, format='json').status_code,
            400,
        )
        blocked = self.client.post(reverse('token-obtain'), {}, format='json')
        self.assertEqual(blocked.status_code, 429)
        self.assertIn('Retry-After', blocked)

    def test_forwarded_header_cannot_reset_anonymous_limit(self) -> None:
        """Ignore a client-supplied IP header with no trusted proxies."""
        url = reverse('token-obtain')
        for address in ('198.51.100.1', '198.51.100.2'):
            self.assertEqual(
                self.client.post(url, {}, format='json', HTTP_X_FORWARDED_FOR=address).status_code,
                400,
            )
        self.assertEqual(
            self.client.post(
                url, {}, format='json', HTTP_X_FORWARDED_FOR='198.51.100.3'
            ).status_code,
            429,
        )

    def test_browser_csrf_requests_are_limited(self) -> None:
        """Limit repeated requests to the public CSRF route."""
        url = reverse('browser-csrf')
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 429)

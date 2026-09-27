from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework.throttling import SimpleRateThrottle

STORAGES_WITHOUT_COLLECTSTATIC = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


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

    def test_browser_login_says_how_long_to_wait(self) -> None:
        """Give a clear message with the wait time after too many tries."""
        browser = Client(enforce_csrf_checks=True)
        browser.get(reverse('browser-csrf'))
        csrf = browser.cookies['csrftoken'].value
        credentials = {'username': 'missing', 'password': 'wrong'}
        for _ in range(2):
            browser.post(reverse('browser-login'), credentials, HTTP_X_CSRFTOKEN=csrf)

        blocked = browser.post(reverse('browser-login'), credentials, HTTP_X_CSRFTOKEN=csrf)

        self.assertEqual(blocked.status_code, 429)
        self.assertRegex(
            blocked.json()['detail'],
            r'^Too many tries\. Please wait \d+ seconds and try again\.$',
        )

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

    @override_settings(STORAGES=STORAGES_WITHOUT_COLLECTSTATIC)
    def test_admin_login_shares_the_login_limit(self) -> None:
        """Count admin password tries together with the API logins."""
        credentials = {'username': 'missing', 'password': 'wrong'}
        self.client.post(reverse('token-obtain'), credentials, format='json')
        self.assertEqual(self.client.post(reverse('admin:login'), credentials).status_code, 200)

        blocked = self.client.post(reverse('admin:login'), credentials)

        self.assertEqual(blocked.status_code, 429)
        self.assertIn('Retry-After', blocked)

    @override_settings(STORAGES=STORAGES_WITHOUT_COLLECTSTATIC)
    def test_admin_login_page_shares_the_public_page_limit(self) -> None:
        """Limit admin login page views together with the CSRF route."""
        self.client.get(reverse('browser-csrf'))
        self.assertEqual(self.client.get(reverse('admin:login')).status_code, 200)

        blocked = self.client.get(reverse('admin:login'))

        self.assertEqual(blocked.status_code, 429)
        self.assertIn('Retry-After', blocked)

    @override_settings(STORAGES=STORAGES_WITHOUT_COLLECTSTATIC)
    def test_admin_login_page_views_do_not_use_login_tries(self) -> None:
        """Keep password tries for real logins."""
        for _ in range(2):
            self.client.get(reverse('admin:login'))

        response = self.client.post(reverse('admin:login'), {'username': 'missing', 'password': 'wrong'})

        self.assertEqual(response.status_code, 200)

    @override_settings(STORAGES=STORAGES_WITHOUT_COLLECTSTATIC)
    def test_staff_can_still_sign_in_to_the_admin(self) -> None:
        """Keep the normal admin login working behind the limit."""
        User.objects.create_user('staff', password='right-password', is_staff=True)

        admin_form = {'username': 'staff', 'password': 'right-password', 'next': reverse('admin:index')}
        response = self.client.post(reverse('admin:login'), admin_form)

        self.assertRedirects(response, reverse('admin:index'), fetch_redirect_response=False)

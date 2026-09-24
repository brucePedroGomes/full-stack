from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.views.debug import SafeExceptionReporterFilter
from rest_framework_simplejwt.tokens import AccessToken


@override_settings(
    ALLOWED_HOSTS=['testserver'],
    SECURE_SSL_REDIRECT=False,
    SESSION_COOKIE_SECURE=False,
    CSRF_COOKIE_SECURE=False,
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'browser-auth-tests',
        },
    },
)
class BrowserAuthenticationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username='ana', password='example-password'
        )

    def csrf_token(self):
        self.client.get(reverse('browser-csrf'))
        return self.client.cookies['csrftoken'].value

    def sign_in(self):
        return self.client.post(
            reverse('browser-login'),
            {'username': 'ana', 'password': 'example-password'},
            HTTP_X_CSRFTOKEN=self.csrf_token(),
        )

    def test_login_creates_protected_session_cookie(self):
        """Save the browser session in an HttpOnly cookie."""
        response = self.sign_in()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.cookies['sessionid']['httponly'])
        self.assertEqual(response.cookies['sessionid']['samesite'], 'Lax')

    def test_login_access_token_authenticates_api(self):
        """Use the token returned by browser login on the API."""
        response = self.sign_in()
        self.client.defaults['HTTP_AUTHORIZATION'] = (
            f'Bearer {response.json()["access"]}'
        )
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)

    def test_session_restores_access_token_after_reload(self):
        """Issue a new API token from the saved browser session."""
        self.sign_in()
        restored = self.client.post(
            reverse('browser-token'), HTTP_X_CSRFTOKEN=self.csrf_token()
        )
        self.assertEqual(restored.status_code, 200)
        self.client.defaults['HTTP_AUTHORIZATION'] = (
            f'Bearer {restored.json()["access"]}'
        )
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)

    def test_session_renews_an_expired_access_token(self):
        """An expired JWT stops API access but does not end the browser session."""
        response = self.sign_in()
        self.assertEqual(set(response.json()), {'access'})
        expired = AccessToken(response.json()['access'])
        expired.set_exp(lifetime=timedelta(seconds=-1))
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {expired}'
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 401)

        renewed = self.client.post(
            reverse('browser-token'), HTTP_X_CSRFTOKEN=self.csrf_token()
        )
        self.assertEqual(renewed.status_code, 200)
        self.assertEqual(set(renewed.json()), {'access'})
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {renewed.json()["access"]}'
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)

    def test_login_response_prevents_caching(self):
        """Prevent browsers and proxies from storing the login token."""
        response = self.sign_in()
        self.assertIn('no-store', response.headers['Cache-Control'])

    def test_token_response_prevents_caching(self):
        """Prevent browsers and proxies from storing a renewed token."""
        self.sign_in()
        response = self.client.post(
            reverse('browser-token'), HTTP_X_CSRFTOKEN=self.csrf_token()
        )
        self.assertIn('no-store', response.headers['Cache-Control'])

    @override_settings(DEBUG=False)
    def test_login_hides_password_from_error_reports(self):
        """Remove the submitted password from production error reports."""
        response = self.sign_in()
        parameters = SafeExceptionReporterFilter().get_post_parameters(
            response.wsgi_request
        )
        self.assertNotEqual(parameters['password'], 'example-password')

    def test_disabled_user_cannot_restore_token(self):
        """Reject token renewal after the user's account is disabled."""
        self.sign_in()
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        response = self.client.post(
            reverse('browser-token'), HTTP_X_CSRFTOKEN=self.csrf_token()
        )
        self.assertEqual(response.status_code, 401)

    def test_logout_ends_browser_session(self):
        """Stop issuing access tokens after browser logout."""
        self.sign_in()
        response = self.client.post(
            reverse('browser-logout'), HTTP_X_CSRFTOKEN=self.csrf_token()
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(
            self.client.post(
                reverse('browser-token'), HTTP_X_CSRFTOKEN=self.csrf_token()
            ).status_code,
            401,
        )

    def test_logout_does_not_revoke_an_issued_access_token(self):
        """A copied JWT remains valid until its short expiry time."""
        response = self.sign_in()
        token = AccessToken(response.json()['access'])
        self.assertEqual(
            int(token['exp']) - int(token['iat']), timedelta(minutes=5).total_seconds()
        )
        logout = self.client.post(
            reverse('browser-logout'), HTTP_X_CSRFTOKEN=self.csrf_token()
        )
        self.assertEqual(logout.status_code, 204)
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
        self.assertEqual(self.client.get(reverse('users:me')).status_code, 200)

    def test_browser_auth_requires_csrf(self):
        """Reject browser login without the CSRF header."""
        self.csrf_token()
        self.assertEqual(
            self.client.post(
                reverse('browser-login'),
                {'username': 'ana', 'password': 'example-password'},
            ).status_code,
            403,
        )

    def test_session_actions_require_csrf(self):
        """Protect token renewal and logout from cross-site posts."""
        self.sign_in()
        self.assertEqual(self.client.post(reverse('browser-token')).status_code, 403)
        self.assertEqual(self.client.post(reverse('browser-logout')).status_code, 403)
        self.assertEqual(
            self.client.post(
                reverse('browser-token'), HTTP_X_CSRFTOKEN=self.csrf_token()
            ).status_code,
            200,
        )

    def test_bad_password_does_not_create_session(self):
        """Reject wrong credentials without starting a session."""
        response = self.client.post(
            reverse('browser-login'),
            {'username': 'ana', 'password': 'wrong-password'},
            HTTP_X_CSRFTOKEN=self.csrf_token(),
        )
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('sessionid', self.client.cookies)

    def test_session_actions_reject_get(self):
        """Reject GET on routes that change browser authentication."""
        for name in ('browser-login', 'browser-token', 'browser-logout'):
            with self.subTest(name=name):
                self.assertEqual(self.client.get(reverse(name)).status_code, 405)

    def test_csrf_endpoint_rejects_post(self):
        """Keep CSRF cookie requests limited to GET."""
        self.assertEqual(
            self.client.post(
                reverse('browser-csrf'), HTTP_X_CSRFTOKEN=self.csrf_token()
            ).status_code,
            405,
        )

    def test_csrf_endpoint_rejects_head(self):
        """Preserve the CSRF endpoint's GET-only contract."""
        self.assertEqual(self.client.head(reverse('browser-csrf')).status_code, 405)

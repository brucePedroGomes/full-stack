from unittest import TestCase

from django.core.exceptions import ImproperlyConfigured

from config.environment import Env


class EnvTests(TestCase):
    def setUp(self):
        """Give each test its own fake environment."""
        self.values = {
            'DJANGO_SECRET_KEY': 'test-only-secret',
            'DB_NAME': 'test',
            'DB_USER': 'test',
            'DB_PASSWORD': 'test',
            'DB_HOST': 'localhost',
        }

    def test_production_defaults_are_secure(self):
        """Debug is off; HTTPS and secure cookies are on."""
        env = Env(self.values)
        self.assertFalse(env.DEBUG)
        self.assertTrue(env.SECURE_SSL_REDIRECT)
        self.assertTrue(env.SESSION_COOKIE_SECURE)
        self.assertTrue(env.CSRF_COOKIE_SECURE)

    def test_debug_allows_local_http(self):
        """Debug enables local development over HTTP."""
        self.values['DJANGO_DEBUG'] = 'true'
        env = Env(self.values)
        self.assertTrue(env.DEBUG)
        self.assertFalse(env.SECURE_SSL_REDIRECT)
        self.assertFalse(env.SESSION_COOKIE_SECURE)
        self.assertFalse(env.CSRF_COOKIE_SECURE)

    def test_invalid_boolean_is_rejected(self):
        """A typo in a boolean produces a clear error."""
        self.values['DJANGO_DEBUG'] = 'flase'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_DEBUG'):
            Env(self.values)

    def test_missing_secret_is_rejected(self):
        """Required values cannot be missing."""
        del self.values['DJANGO_SECRET_KEY']
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_SECRET_KEY'):
            Env(self.values)

    def test_blank_secret_is_rejected(self):
        """Spaces alone do not count as a secret."""
        self.values['DJANGO_SECRET_KEY'] = '   '
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_SECRET_KEY'):
            Env(self.values)

    def test_port_becomes_an_integer(self):
        """Convert the environment's text value to a number."""
        self.values['DB_PORT'] = '5439'
        self.assertEqual(Env(self.values).DB_PORT, 5439)

    def test_port_must_be_a_number(self):
        """Reject text that cannot be converted to a port."""
        self.values['DB_PORT'] = 'invalid'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DB_PORT'):
            Env(self.values)

    def test_port_must_be_in_range(self):
        """Reject ports above the allowed limit."""
        self.values['DB_PORT'] = '70000'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DB_PORT'):
            Env(self.values)

    def test_hsts_duration_cannot_be_negative(self):
        """The HTTPS policy duration cannot be negative."""
        self.values['DJANGO_SECURE_HSTS_SECONDS'] = '-1'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_SECURE_HSTS_SECONDS'):
            Env(self.values)

    def test_host_list_removes_spaces_and_empty_items(self):
        """Turn comma-separated hosts into a clean list."""
        self.values['DJANGO_ALLOWED_HOSTS'] = ' localhost, api.example.com, '
        self.assertEqual(
            Env(self.values).ALLOWED_HOSTS, ['localhost', 'api.example.com']
        )

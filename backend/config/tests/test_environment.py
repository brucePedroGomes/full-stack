from unittest import TestCase

from django.core.exceptions import ImproperlyConfigured

from config.environment import Env


class EnvTests(TestCase):
    def setUp(self):
        """Give each test its own fake environment."""
        self.values = {
            'DJANGO_SECRET_KEY': 'test-only-secret',
            'DJANGO_PASSWORD_PEPPER': 'ab' * 32,
            'DJANGO_EMAIL_HOST': 'smtp.example.com',
            'DJANGO_EMAIL_FROM': 'challenge@example.com',
            'DJANGO_CACHE_URL': 'redis://localhost:6379/0',
            'DB_NAME': 'test',
            'DB_USER': 'test',
            'DB_PASSWORD': 'test',
            'DB_HOST': 'localhost',
        }

    def test_production_defaults_are_secure(self):
        """Debug is off; HTTPS and secure cookies are on."""
        env = Env(self.values)
        self.assertFalse(env.DEBUG)
        self.assertFalse(env.ENABLE_API_DOCS)
        self.assertTrue(env.SECURE_SSL_REDIRECT)
        self.assertTrue(env.SESSION_COOKIE_SECURE)
        self.assertTrue(env.CSRF_COOKIE_SECURE)
        self.assertEqual(env.EMAIL_HOST, 'smtp.example.com')
        self.assertEqual(env.NUM_PROXIES, 0)

    def test_production_requires_shared_cache(self):
        """Require a cache that all API workers can use."""
        del self.values['DJANGO_CACHE_URL']
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_CACHE_URL'):
            Env(self.values)

    def test_cache_url_must_use_redis(self):
        """Reject cache URLs for unsupported backends."""
        self.values['DJANGO_CACHE_URL'] = 'http://localhost:6379'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_CACHE_URL'):
            Env(self.values)

    def test_proxy_count_cannot_be_negative(self):
        """Reject invalid proxy counts for IP rate limits."""
        self.values['DJANGO_NUM_PROXIES'] = '-1'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_NUM_PROXIES'):
            Env(self.values)

    def test_production_requires_email_host(self):
        """Require an SMTP host when debug is off."""
        del self.values['DJANGO_EMAIL_HOST']
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_EMAIL_HOST'):
            Env(self.values)

    def test_invalid_email_port_is_rejected(self):
        """Reject SMTP ports outside the valid range."""
        self.values['DJANGO_EMAIL_PORT'] = '70000'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_EMAIL_PORT'):
            Env(self.values)

    def test_production_requires_sender_address(self):
        """Require a sender address for production email."""
        del self.values['DJANGO_EMAIL_FROM']
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_EMAIL_FROM'):
            Env(self.values)

    def test_smtp_login_values_must_be_set_together(self):
        """Reject an SMTP username without a password."""
        self.values['DJANGO_EMAIL_USERNAME'] = 'mailer'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_EMAIL_USERNAME'):
            Env(self.values)

    def test_debug_allows_local_http(self):
        """Debug enables local development over HTTP."""
        self.values['DJANGO_DEBUG'] = 'true'
        del self.values['DJANGO_CACHE_URL']
        env = Env(self.values)
        self.assertTrue(env.DEBUG)
        self.assertTrue(env.ENABLE_API_DOCS)
        self.assertFalse(env.SECURE_SSL_REDIRECT)
        self.assertFalse(env.SESSION_COOKIE_SECURE)
        self.assertFalse(env.CSRF_COOKIE_SECURE)
        self.assertEqual(env.CACHE_URL, '')

    def test_staging_can_enable_docs_without_debug(self):
        """Allow staging docs while keeping debug off."""
        self.values['DJANGO_ENABLE_API_DOCS'] = 'true'
        env = Env(self.values)
        self.assertFalse(env.DEBUG)
        self.assertTrue(env.ENABLE_API_DOCS)
        self.assertTrue(env.SECURE_SSL_REDIRECT)

    def test_argon2_defaults(self):
        """Use the expected Argon2 costs when they are not set."""
        env = Env(self.values)
        self.assertEqual(env.ARGON2_TIME_COST, 2)
        self.assertEqual(env.ARGON2_MEMORY_COST, 102400)
        self.assertEqual(env.ARGON2_PARALLELISM, 8)

    def test_invalid_argon2_values_are_rejected(self):
        """Reject bad values for each Argon2 cost."""
        for name in ('TIME_COST', 'MEMORY_COST', 'PARALLELISM'):
            key = f'DJANGO_ARGON2_{name}'
            for value in ('0', '-1', '', 'invalid', '1.5'):
                with self.subTest(setting=key, value=value):
                    with self.assertRaisesRegex(ImproperlyConfigured, key):
                        Env({**self.values, key: value})

    def test_argon2_memory_must_support_parallelism(self):
        """Require enough memory for the selected thread count."""
        self.values['DJANGO_ARGON2_MEMORY_COST'] = '63'
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_ARGON2_MEMORY_COST'):
            Env(self.values)

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

    def test_missing_pepper_is_rejected(self):
        """Require a separate password pepper."""
        del self.values['DJANGO_PASSWORD_PEPPER']
        with self.assertRaisesRegex(ImproperlyConfigured, 'DJANGO_PASSWORD_PEPPER'):
            Env(self.values)

    def test_invalid_pepper_is_rejected_without_exposing_it(self):
        """Reject invalid peppers without printing their values."""
        for value in ('', '   ', 'short-secret', 'g' * 64, 'ab' * 31):
            with self.subTest(value=value):
                with self.assertRaises(ImproperlyConfigured) as error:
                    Env({**self.values, 'DJANGO_PASSWORD_PEPPER': value})
                self.assertIn('DJANGO_PASSWORD_PEPPER', str(error.exception))
                if value.strip():
                    self.assertNotIn(value, str(error.exception))

    def test_pepper_cannot_reuse_django_secret(self):
        """Keep the password pepper separate from the Django secret."""
        self.values['DJANGO_SECRET_KEY'] = self.values['DJANGO_PASSWORD_PEPPER']
        with self.assertRaisesRegex(ImproperlyConfigured, 'must be different'):
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

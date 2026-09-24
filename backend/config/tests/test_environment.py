from unittest import TestCase

from pydantic import ValidationError

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
            'CELERY_BROKER_URL': 'redis://localhost:6379/1',
            'DB_NAME': 'test',
            'DB_USER': 'test',
            'DB_PASSWORD': 'test',
            'DB_HOST': 'localhost',
        }

    def _load_env(self, values=None):
        return Env.model_validate(self.values if values is None else values)

    def test_unrelated_environment_variables_are_ignored(self):
        """Accept the full process environment without storing unrelated values."""
        self.values['PATH'] = '/test/bin'
        self.values['UNRELATED_SECRET'] = 'private-unrelated-value'
        env = self._load_env()

        self.assertNotIn('PATH', env.model_dump())
        self.assertNotIn('UNRELATED_SECRET', env.model_dump())

    def test_production_defaults_are_secure(self):
        """Debug is off; HTTPS and secure cookies are on."""
        env = self._load_env()
        self.assertFalse(env.DJANGO_DEBUG)
        self.assertFalse(env.DJANGO_ENABLE_API_DOCS)
        self.assertTrue(env.DJANGO_SECURE_SSL_REDIRECT)
        self.assertTrue(env.DJANGO_SESSION_COOKIE_SECURE)
        self.assertTrue(env.DJANGO_CSRF_COOKIE_SECURE)
        self.assertEqual(env.DJANGO_EMAIL_HOST, 'smtp.example.com')
        self.assertEqual(env.DJANGO_NUM_PROXIES, 0)

    def test_production_requires_shared_cache(self):
        """Require a cache that all API workers can use."""
        del self.values['DJANGO_CACHE_URL']
        with self.assertRaisesRegex(ValidationError, 'DJANGO_CACHE_URL'):
            self._load_env()

    def test_cache_url_must_use_redis(self):
        """Reject cache URLs for unsupported backends."""
        self.values['DJANGO_CACHE_URL'] = 'http://localhost:6379'
        with self.assertRaisesRegex(ValidationError, 'DJANGO_CACHE_URL'):
            self._load_env()

    def test_proxy_count_cannot_be_negative(self):
        """Reject invalid proxy counts for IP rate limits."""
        self.values['DJANGO_NUM_PROXIES'] = '-1'
        with self.assertRaisesRegex(ValidationError, 'DJANGO_NUM_PROXIES'):
            self._load_env()

    def test_production_requires_celery_broker(self):
        """Require the Redis job queue outside local development."""
        del self.values['CELERY_BROKER_URL']
        with self.assertRaisesRegex(ValidationError, 'CELERY_BROKER_URL'):
            self._load_env()

    def test_celery_broker_must_use_redis(self):
        """Reject blank and unsupported broker URLs."""
        for value in ('', '   ', 'amqp://localhost', 'http://localhost:6379'):
            with self.subTest(value=value):
                self.values['CELERY_BROKER_URL'] = value
                with self.assertRaisesRegex(ValidationError, 'CELERY_BROKER_URL'):
                    self._load_env()

    def test_debug_requires_service_urls_and_sender(self):
        """Debug mode does not hide missing application configuration."""
        self.values['DJANGO_DEBUG'] = 'true'
        for key in ('DJANGO_CACHE_URL', 'CELERY_BROKER_URL', 'DJANGO_EMAIL_FROM'):
            with self.subTest(setting=key):
                values = self.values.copy()
                del values[key]
                with self.assertRaisesRegex(ValidationError, key):
                    self._load_env(values)

    def test_production_requires_email_host(self):
        """Require an SMTP host when debug is off."""
        del self.values['DJANGO_EMAIL_HOST']
        with self.assertRaisesRegex(ValidationError, 'DJANGO_EMAIL_HOST'):
            self._load_env()

    def test_invalid_email_port_is_rejected(self):
        """Reject SMTP ports outside the valid range."""
        self.values['DJANGO_EMAIL_PORT'] = '70000'
        with self.assertRaisesRegex(ValidationError, 'DJANGO_EMAIL_PORT'):
            self._load_env()

    def test_production_requires_sender_address(self):
        """Require a sender address for production email."""
        del self.values['DJANGO_EMAIL_FROM']
        with self.assertRaisesRegex(ValidationError, 'DJANGO_EMAIL_FROM'):
            self._load_env()

    def test_smtp_login_values_must_be_set_together(self):
        """Reject an SMTP username without a password."""
        self.values['DJANGO_EMAIL_USERNAME'] = 'mailer'
        with self.assertRaisesRegex(ValidationError, 'DJANGO_EMAIL_USERNAME'):
            self._load_env()

    def test_debug_does_not_change_security_or_docs_defaults(self):
        """Require explicit local overrides instead of changing other settings."""
        self.values['DJANGO_DEBUG'] = 'true'
        env = self._load_env()
        self.assertTrue(env.DJANGO_DEBUG)
        self.assertFalse(env.DJANGO_ENABLE_API_DOCS)
        self.assertTrue(env.DJANGO_SECURE_SSL_REDIRECT)
        self.assertTrue(env.DJANGO_SESSION_COOKIE_SECURE)
        self.assertTrue(env.DJANGO_CSRF_COOKIE_SECURE)

    def test_staging_can_enable_docs_without_debug(self):
        """Allow staging docs while keeping debug off."""
        self.values['DJANGO_ENABLE_API_DOCS'] = 'true'
        env = self._load_env()
        self.assertFalse(env.DJANGO_DEBUG)
        self.assertTrue(env.DJANGO_ENABLE_API_DOCS)
        self.assertTrue(env.DJANGO_SECURE_SSL_REDIRECT)

    def test_argon2_defaults(self):
        """Use the expected Argon2 costs when they are not set."""
        env = self._load_env()
        self.assertEqual(env.DJANGO_ARGON2_TIME_COST, 2)
        self.assertEqual(env.DJANGO_ARGON2_MEMORY_COST, 102400)
        self.assertEqual(env.DJANGO_ARGON2_PARALLELISM, 8)

    def test_invalid_argon2_values_are_rejected(self):
        """Reject bad values for each Argon2 cost."""
        for name in ('TIME_COST', 'MEMORY_COST', 'PARALLELISM'):
            key = f'DJANGO_ARGON2_{name}'
            for value in ('0', '-1', '', 'invalid', '1.5'):
                with self.subTest(setting=key, value=value):
                    with self.assertRaisesRegex(ValidationError, key):
                        self._load_env({**self.values, key: value})

    def test_argon2_memory_must_support_parallelism(self):
        """Require enough memory for the selected thread count."""
        self.values['DJANGO_ARGON2_MEMORY_COST'] = '63'
        with self.assertRaisesRegex(ValidationError, 'DJANGO_ARGON2_MEMORY_COST'):
            self._load_env()

    def test_invalid_boolean_is_rejected(self):
        """A typo in a boolean produces a clear error."""
        self.values['DJANGO_DEBUG'] = 'flase'
        with self.assertRaisesRegex(ValidationError, 'DJANGO_DEBUG'):
            self._load_env()

    def test_missing_secret_is_rejected(self):
        """Required values cannot be missing."""
        del self.values['DJANGO_SECRET_KEY']
        with self.assertRaisesRegex(ValidationError, 'DJANGO_SECRET_KEY'):
            self._load_env()

    def test_blank_secret_is_rejected(self):
        """Spaces alone do not count as a secret."""
        self.values['DJANGO_SECRET_KEY'] = '   '
        with self.assertRaisesRegex(ValidationError, 'DJANGO_SECRET_KEY'):
            self._load_env()

    def test_missing_pepper_is_rejected(self):
        """Require a separate password pepper."""
        del self.values['DJANGO_PASSWORD_PEPPER']
        with self.assertRaisesRegex(ValidationError, 'DJANGO_PASSWORD_PEPPER'):
            self._load_env()

    def test_invalid_pepper_is_rejected_without_exposing_it(self):
        """Reject invalid peppers without printing their values."""
        for value in ('', '   ', 'short-secret', 'g' * 64, 'ab' * 31):
            with self.subTest(value=value):
                with self.assertRaises(ValidationError) as error:
                    self._load_env({**self.values, 'DJANGO_PASSWORD_PEPPER': value})
                self.assertIn('DJANGO_PASSWORD_PEPPER', str(error.exception))
                if value.strip():
                    self.assertNotIn(value, str(error.exception))

    def test_pepper_cannot_reuse_django_secret(self):
        """Keep the password pepper separate from the Django secret."""
        self.values['DJANGO_SECRET_KEY'] = self.values['DJANGO_PASSWORD_PEPPER']
        with self.assertRaisesRegex(ValidationError, 'must be different'):
            self._load_env()

    def test_port_becomes_an_integer(self):
        """Convert the environment's text value to a number."""
        self.values['DB_PORT'] = '5439'
        self.assertEqual(self._load_env().DB_PORT, 5439)

    def test_port_must_be_a_number(self):
        """Reject text that cannot be converted to a port."""
        self.values['DB_PORT'] = 'invalid'
        with self.assertRaisesRegex(ValidationError, 'DB_PORT'):
            self._load_env()

    def test_port_must_be_in_range(self):
        """Reject ports above the allowed limit."""
        self.values['DB_PORT'] = '70000'
        with self.assertRaisesRegex(ValidationError, 'DB_PORT'):
            self._load_env()

    def test_hsts_duration_cannot_be_negative(self):
        """The HTTPS policy duration cannot be negative."""
        self.values['DJANGO_SECURE_HSTS_SECONDS'] = '-1'
        with self.assertRaisesRegex(ValidationError, 'DJANGO_SECURE_HSTS_SECONDS'):
            self._load_env()

    def test_host_list_uses_json(self):
        """Parse the environment's JSON array with Pydantic."""
        self.values['DJANGO_ALLOWED_HOSTS'] = '["localhost", "api.example.com"]'
        self.assertEqual(
            self._load_env().DJANGO_ALLOWED_HOSTS, ['localhost', 'api.example.com']
        )

    def test_local_settings_are_explicit(self):
        """Allow local HTTP and API docs when their settings are enabled."""
        self.values.update({
            'DJANGO_DEBUG': 'true',
            'DJANGO_ENABLE_API_DOCS': 'true',
            'DJANGO_SESSION_COOKIE_SECURE': 'false',
            'DJANGO_CSRF_COOKIE_SECURE': 'false',
            'DJANGO_SECURE_SSL_REDIRECT': 'false',
        })
        env = self._load_env()
        self.assertTrue(env.DJANGO_ENABLE_API_DOCS)
        self.assertFalse(env.DJANGO_SESSION_COOKIE_SECURE)
        self.assertFalse(env.DJANGO_CSRF_COOKIE_SECURE)
        self.assertFalse(env.DJANGO_SECURE_SSL_REDIRECT)
        self.assertEqual(env.DJANGO_EMAIL_FROM, self.values['DJANGO_EMAIL_FROM'])
        self.assertEqual(env.CELERY_BROKER_URL, self.values['CELERY_BROKER_URL'])

    def test_console_email_needs_a_sender_but_no_smtp_host(self):
        """Local console email still has an explicit, nonblank sender."""
        self.values['DJANGO_DEBUG'] = 'true'
        del self.values['DJANGO_EMAIL_HOST']
        env = self._load_env()
        self.assertEqual(env.DJANGO_EMAIL_HOST, '')
        self.assertEqual(env.DJANGO_EMAIL_FROM, self.values['DJANGO_EMAIL_FROM'])
        for value in ('', '   '):
            with self.subTest(value=value):
                self.values['DJANGO_EMAIL_FROM'] = value
                with self.assertRaisesRegex(ValidationError, 'DJANGO_EMAIL_FROM'):
                    self._load_env()

    def test_standard_boolean_spellings(self):
        """Use Pydantic's boolean parsing without custom whitespace cleanup."""
        for expected, spellings in (
            (True, ('true', '1', 'yes', 'on', 't', 'y')),
            (False, ('false', '0', 'no', 'off', 'f', 'n')),
        ):
            for value in spellings:
                with self.subTest(value=value):
                    self.values['DJANGO_DEBUG'] = value.upper()
                    self.assertIs(self._load_env().DJANGO_DEBUG, expected)
        for value in ('', ' ', 'maybe', '2', ' true '):
            with self.subTest(value=value):
                self.values['DJANGO_DEBUG'] = value
                with self.assertRaisesRegex(ValidationError, 'DJANGO_DEBUG'):
                    self._load_env()

    def test_integer_fields_reject_fractional_values(self):
        """Ports and hashing costs must be whole numbers."""
        for key in ('DB_PORT', 'DJANGO_EMAIL_PORT', 'DJANGO_ARGON2_TIME_COST'):
            for value in ('1.5', '1e2'):
                with self.subTest(setting=key, value=value):
                    with self.assertRaisesRegex(ValidationError, key):
                        self._load_env({**self.values, key: value})

    def test_integer_fields_use_pydantic_parsing(self):
        """Pydantic accepts decimal notation when the value is a whole number."""
        self.values['DB_PORT'] = '5432.0'
        self.assertEqual(self._load_env().DB_PORT, 5432)

    def test_required_database_values_cannot_be_missing_or_blank(self):
        """Required database values cannot be empty."""
        for key in ('DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'):
            for value in (None, '', '   '):
                with self.subTest(setting=key, value=value):
                    values = self.values.copy()
                    if value is None:
                        del values[key]
                    else:
                        values[key] = value
                    with self.assertRaisesRegex(ValidationError, key):
                        self._load_env(values)

    def test_environment_names_remain_case_sensitive(self):
        """Ignore unrelated names instead of reading new aliases by accident."""
        for alias in ('django_secret_key', 'SECRET_KEY'):
            with self.subTest(alias=alias):
                values = self.values.copy()
                values[alias] = values.pop('DJANGO_SECRET_KEY')
                with self.assertRaisesRegex(ValidationError, 'DJANGO_SECRET_KEY'):
                    self._load_env(values)
        values = self.values.copy()
        values['DJANGO_DB_HOST'] = values.pop('DB_HOST')
        with self.assertRaisesRegex(ValidationError, 'DB_HOST'):
            self._load_env(values)

    def test_csrf_origins_use_json(self):
        """Read a JSON array of trusted origins."""
        self.values['DJANGO_CSRF_TRUSTED_ORIGINS'] = '["https://a.example", "https://b.example"]'
        self.assertEqual(
            self._load_env().DJANGO_CSRF_TRUSTED_ORIGINS,
            ['https://a.example', 'https://b.example'],
        )
        self.values['DJANGO_CSRF_TRUSTED_ORIGINS'] = '[]'
        self.assertEqual(self._load_env().DJANGO_CSRF_TRUSTED_ORIGINS, [])

    def test_redis_urls_cannot_be_blank_or_contain_spaces(self):
        """Reject bad URL values instead of silently changing them."""
        for key in ('DJANGO_CACHE_URL', 'CELERY_BROKER_URL'):
            for value in ('', '   ', ' redis://localhost:6379/0', 'redis://localhost:6379/0 '):
                with self.subTest(setting=key, value=value):
                    with self.assertRaisesRegex(ValidationError, key):
                        self._load_env({**self.values, key: value})

    def test_list_settings_reject_invalid_json_or_item_types(self):
        """Both list settings require JSON arrays of strings."""
        for key in ('DJANGO_ALLOWED_HOSTS', 'DJANGO_CSRF_TRUSTED_ORIGINS'):
            for value in ('localhost,127.0.0.1', '[1]', '{}', '[invalid]'):
                with self.subTest(setting=key, value=value):
                    with self.assertRaisesRegex(ValidationError, key):
                        self._load_env({**self.values, key: value})

    def test_optional_lists_default_to_empty_lists(self):
        """Use empty lists when the variables are absent."""
        env = self._load_env()
        self.assertEqual(env.DJANGO_ALLOWED_HOSTS, [])
        self.assertEqual(env.DJANGO_CSRF_TRUSTED_ORIGINS, [])

    def test_secrets_keep_their_original_whitespace(self):
        """Checking for blank secrets must not change valid secret values."""
        self.values['DJANGO_SECRET_KEY'] = ' secret with spaces '
        self.values['DB_PASSWORD'] = ' password with spaces '
        env = self._load_env()
        self.assertEqual(env.DJANGO_SECRET_KEY, self.values['DJANGO_SECRET_KEY'])
        self.assertEqual(env.DB_PASSWORD, self.values['DB_PASSWORD'])

    def test_field_errors_report_names_without_input_values(self):
        """Report multiple bad fields without including their raw values."""
        self.values.update({
            'DB_PORT': 'private-invalid-port',
            'CELERY_BROKER_URL': 'https://user:private-token@example.com',
        })
        with self.assertRaises(ValidationError) as error:
            self._load_env()
        message = str(error.exception)
        self.assertIn('DB_PORT', message)
        self.assertIn('CELERY_BROKER_URL', message)
        self.assertNotIn('private-invalid-port', message)
        self.assertNotIn('private-token', message)
        self.assertNotIn(self.values['DJANGO_SECRET_KEY'], message)

    def test_related_setting_errors_do_not_expose_the_environment(self):
        """Model-level errors must not display the complete settings input."""
        self.values['DJANGO_SECRET_KEY'] = self.values['DJANGO_PASSWORD_PEPPER']
        self.values['DB_PASSWORD'] = 'private-database-password'
        with self.assertRaises(ValidationError) as error:
            self._load_env()
        message = str(error.exception)
        self.assertIn('must be different', message)
        self.assertNotIn(self.values['DJANGO_SECRET_KEY'], message)
        self.assertNotIn(self.values['DB_PASSWORD'], message)

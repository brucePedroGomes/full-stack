import os
import runpy
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase


class SettingsTests(SimpleTestCase):
    def setUp(self):
        self.values = {
            'DJANGO_SECRET_KEY': 'test-only-secret',
            'DJANGO_PASSWORD_PEPPER': 'ab' * 32,
            'DJANGO_EMAIL_HOST': 'smtp.example.com',
            'DJANGO_EMAIL_FROM': 'challenge@example.com',
            'DJANGO_ARGON2_TIME_COST': '3',
            'DJANGO_ARGON2_MEMORY_COST': '65536',
            'DJANGO_ARGON2_PARALLELISM': '4',
            'DB_NAME': 'test',
            'DB_USER': 'test',
            'DB_PASSWORD': 'test',
            'DB_HOST': 'localhost',
            'DB_PORT': '5439',
        }

    def _load_settings(self):
        with patch.dict(os.environ, self.values, clear=True):
            return runpy.run_path(str(Path(__file__).resolve().parents[1] / 'settings.py'))

    def test_settings_use_environment_values(self):
        """Pass secrets, Argon2 costs, and database values to Django."""
        settings = self._load_settings()

        self.assertEqual(settings['SECRET_KEY'], 'test-only-secret')
        self.assertEqual(settings['PASSWORD_PEPPER'], 'ab' * 32)
        self.assertEqual(
            settings['PASSWORD_HASHERS'],
            ['config.hashers.ConfigurableArgon2PasswordHasher'],
        )
        self.assertEqual(settings['ARGON2_TIME_COST'], 3)
        self.assertEqual(settings['ARGON2_MEMORY_COST'], 65536)
        self.assertEqual(settings['ARGON2_PARALLELISM'], 4)
        self.assertEqual(settings['DATABASES']['default']['PORT'], 5439)
        self.assertEqual(settings['STATIC_ROOT'], settings['BASE_DIR'] / 'staticfiles')

    def test_development_uses_local_features(self):
        """Allow local HTTP, browsable API, and console email in debug."""
        self.values['DJANGO_DEBUG'] = 'true'
        settings = self._load_settings()

        self.assertTrue(settings['ENABLE_API_DOCS'])
        self.assertFalse(settings['SECURE_SSL_REDIRECT'])
        self.assertIn(
            'rest_framework.renderers.BrowsableAPIRenderer',
            settings['REST_FRAMEWORK']['DEFAULT_RENDERER_CLASSES'],
        )
        self.assertNotIn('whitenoise.middleware.WhiteNoiseMiddleware', settings['MIDDLEWARE'])
        self.assertEqual(
            settings['MAILERS']['default']['BACKEND'],
            'django.core.mail.backends.console.EmailBackend',
        )

    def test_production_uses_secure_features(self):
        """Use secure cookies, SMTP, and static file serving in production."""
        settings = self._load_settings()

        self.assertEqual(
            settings['REST_FRAMEWORK']['DEFAULT_RENDERER_CLASSES'],
            ['rest_framework.renderers.JSONRenderer'],
        )
        self.assertTrue(settings['SECURE_SSL_REDIRECT'])
        self.assertTrue(settings['SESSION_COOKIE_SECURE'])
        self.assertTrue(settings['CSRF_COOKIE_SECURE'])
        self.assertFalse(settings['ENABLE_API_DOCS'])
        self.assertIn('whitenoise.middleware.WhiteNoiseMiddleware', settings['MIDDLEWARE'])
        self.assertEqual(
            settings['MAILERS']['default']['BACKEND'],
            'django.core.mail.backends.smtp.EmailBackend',
        )
        self.assertEqual(
            settings['MAILERS']['default']['OPTIONS']['host'], 'smtp.example.com'
        )
        self.assertEqual(settings['DEFAULT_FROM_EMAIL'], 'challenge@example.com')

    def test_staging_can_enable_docs_without_debug(self):
        """Allow Swagger in staging while keeping production renderers."""
        self.values['DJANGO_ENABLE_API_DOCS'] = 'true'
        settings = self._load_settings()

        self.assertFalse(settings['DEBUG'])
        self.assertTrue(settings['ENABLE_API_DOCS'])
        self.assertEqual(
            settings['REST_FRAMEWORK']['DEFAULT_RENDERER_CLASSES'],
            ['rest_framework.renderers.JSONRenderer'],
        )

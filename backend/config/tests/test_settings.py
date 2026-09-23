import os
import runpy
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase


class SettingsTests(SimpleTestCase):
    def test_django_uses_environment_values(self):
        """Django receives the values read and converted by Env."""
        values = {
            'DJANGO_SECRET_KEY': 'test-only-secret',
            'DJANGO_PASSWORD_PEPPER': 'ab' * 32,
            'DJANGO_DEBUG': 'true',
            'DJANGO_ARGON2_TIME_COST': '3',
            'DJANGO_ARGON2_MEMORY_COST': '65536',
            'DJANGO_ARGON2_PARALLELISM': '4',
            'DB_NAME': 'test',
            'DB_USER': 'test',
            'DB_PASSWORD': 'test',
            'DB_HOST': 'localhost',
            'DB_PORT': '5439',
        }
        with patch.dict(os.environ, values, clear=True):
            settings = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'settings.py'))

        self.assertEqual(settings['SECRET_KEY'], 'test-only-secret')
        self.assertEqual(settings['PASSWORD_PEPPER'], 'ab' * 32)
        self.assertTrue(settings['DEBUG'])
        self.assertEqual(
            settings['PASSWORD_HASHERS'],
            ['config.hashers.ConfigurableArgon2PasswordHasher'],
        )
        self.assertEqual(settings['ARGON2_TIME_COST'], 3)
        self.assertEqual(settings['ARGON2_MEMORY_COST'], 65536)
        self.assertEqual(settings['ARGON2_PARALLELISM'], 4)
        self.assertFalse(settings['SECURE_SSL_REDIRECT'])
        self.assertEqual(settings['DATABASES']['default']['PORT'], 5439)

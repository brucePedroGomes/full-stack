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
            'DJANGO_DEBUG': 'true',
            'DB_NAME': 'test',
            'DB_USER': 'test',
            'DB_PASSWORD': 'test',
            'DB_HOST': 'localhost',
            'DB_PORT': '5439',
        }
        with patch.dict(os.environ, values, clear=True):
            settings = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'settings.py'))

        self.assertEqual(settings['SECRET_KEY'], 'test-only-secret')
        self.assertTrue(settings['DEBUG'])
        self.assertFalse(settings['SECURE_SSL_REDIRECT'])
        self.assertEqual(settings['DATABASES']['default']['PORT'], 5439)

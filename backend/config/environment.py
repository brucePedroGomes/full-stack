"""Read and validate environment values before Django starts."""

import os

from django.core.exceptions import ImproperlyConfigured


class Env:
    """Load one set of values; tests can supply a plain dictionary."""

    def __init__(self, values=None):
        self._values = dict(os.environ if values is None else values)

        self.SECRET_KEY = self._required('DJANGO_SECRET_KEY')
        self.DEBUG = self._bool('DJANGO_DEBUG')
        self.ALLOWED_HOSTS = self._list('DJANGO_ALLOWED_HOSTS')
        self.SESSION_COOKIE_SECURE = self._bool(
            'DJANGO_SESSION_COOKIE_SECURE', default=not self.DEBUG
        )
        self.CSRF_COOKIE_SECURE = self._bool(
            'DJANGO_CSRF_COOKIE_SECURE', default=not self.DEBUG
        )
        self.SECURE_SSL_REDIRECT = self._bool(
            'DJANGO_SECURE_SSL_REDIRECT', default=not self.DEBUG
        )
        self.TRUST_PROXY = self._bool('DJANGO_TRUST_PROXY')
        self.SECURE_HSTS_SECONDS = self._int('DJANGO_SECURE_HSTS_SECONDS', 0)
        self.SECURE_HSTS_INCLUDE_SUBDOMAINS = self._bool(
            'DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS'
        )
        self.SECURE_HSTS_PRELOAD = self._bool('DJANGO_SECURE_HSTS_PRELOAD')
        self.CSRF_TRUSTED_ORIGINS = self._list('DJANGO_CSRF_TRUSTED_ORIGINS')

        self.DB_NAME = self._required('DB_NAME')
        self.DB_USER = self._required('DB_USER')
        self.DB_PASSWORD = self._required('DB_PASSWORD')
        self.DB_HOST = self._required('DB_HOST')
        self.DB_PORT = self._int('DB_PORT', 5432)
        self.DB_SSLMODE = self._values.get('DB_SSLMODE', 'prefer')
        self.DB_SSLROOTCERT = self._values.get('DB_SSLROOTCERT', '')

        if not 1 <= self.DB_PORT <= 65535:
            raise ImproperlyConfigured('DB_PORT must be between 1 and 65535.')
        if self.SECURE_HSTS_SECONDS < 0:
            raise ImproperlyConfigured('DJANGO_SECURE_HSTS_SECONDS cannot be negative.')

    def _required(self, name):
        """Reject missing or blank values without printing secrets."""
        value = self._values.get(name, '')
        if not value.strip():
            raise ImproperlyConfigured(f'{name} is required.')
        return value

    def _bool(self, name, default=False):
        """Accept common boolean values; reject typos."""
        value = self._values.get(name, str(default)).strip().lower()
        if value in {'true', '1', 'yes', 'on'}:
            return True
        if value in {'false', '0', 'no', 'off'}:
            return False
        raise ImproperlyConfigured(f'{name} must be a boolean (true or false).')

    def _int(self, name, default):
        """Name the setting when its value is not an integer."""
        try:
            return int(self._values.get(name, str(default)))
        except ValueError:
            raise ImproperlyConfigured(f'{name} must be an integer.') from None

    def _list(self, name):
        """Split comma-separated values and remove empty entries."""
        return [
            value.strip() for value in self._values.get(name, '').split(',')
            if value.strip()
        ]

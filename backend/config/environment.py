"""Read and validate environment values before Django starts."""

import os
import re

from django.core.exceptions import ImproperlyConfigured


class Env:
    """Load one set of values; tests can supply a plain dictionary."""

    def __init__(self, values=None):
        self._values = dict(os.environ if values is None else values)

        self.SECRET_KEY = self._required('DJANGO_SECRET_KEY')
        self.PASSWORD_PEPPER = self._required('DJANGO_PASSWORD_PEPPER')
        if not re.fullmatch(r'[0-9a-fA-F]{64}', self.PASSWORD_PEPPER):
            raise ImproperlyConfigured(
                'DJANGO_PASSWORD_PEPPER must contain exactly 64 hexadecimal characters.'
            )
        if self.PASSWORD_PEPPER == self.SECRET_KEY:
            raise ImproperlyConfigured(
                'DJANGO_PASSWORD_PEPPER must be different from DJANGO_SECRET_KEY.'
            )
        self.ARGON2_TIME_COST = self._int('DJANGO_ARGON2_TIME_COST', 2)
        self.ARGON2_MEMORY_COST = self._int('DJANGO_ARGON2_MEMORY_COST', 102400)
        self.ARGON2_PARALLELISM = self._int('DJANGO_ARGON2_PARALLELISM', 8)
        for name in ('ARGON2_TIME_COST', 'ARGON2_MEMORY_COST', 'ARGON2_PARALLELISM'):
            if getattr(self, name) <= 0:
                raise ImproperlyConfigured(f'DJANGO_{name} must be positive.')
        if self.ARGON2_MEMORY_COST < 8 * self.ARGON2_PARALLELISM:
            raise ImproperlyConfigured(
                'DJANGO_ARGON2_MEMORY_COST must be at least '
                '8 times DJANGO_ARGON2_PARALLELISM (in KiB).'
            )
        self.DEBUG = self._bool('DJANGO_DEBUG')
        self.ENABLE_API_DOCS = self._bool('DJANGO_ENABLE_API_DOCS', default=self.DEBUG)
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
        self.EMAIL_HOST = (
            self._values.get('DJANGO_EMAIL_HOST', '')
            if self.DEBUG else self._required('DJANGO_EMAIL_HOST')
        )
        self.EMAIL_FROM = (
            self._values.get('DJANGO_EMAIL_FROM', 'webmaster@localhost')
            if self.DEBUG else self._required('DJANGO_EMAIL_FROM')
        )
        self.EMAIL_PORT = self._int('DJANGO_EMAIL_PORT', 587)
        self.EMAIL_USERNAME = self._values.get('DJANGO_EMAIL_USERNAME', '')
        self.EMAIL_PASSWORD = self._values.get('DJANGO_EMAIL_PASSWORD', '')
        self.EMAIL_USE_TLS = self._bool('DJANGO_EMAIL_USE_TLS', default=True)

        self.DB_NAME = self._required('DB_NAME')
        self.DB_USER = self._required('DB_USER')
        self.DB_PASSWORD = self._required('DB_PASSWORD')
        self.DB_HOST = self._required('DB_HOST')
        self.DB_PORT = self._int('DB_PORT', 5432)
        self.DB_SSLMODE = self._values.get('DB_SSLMODE', 'prefer')
        self.DB_SSLROOTCERT = self._values.get('DB_SSLROOTCERT', '')

        if not 1 <= self.DB_PORT <= 65535:
            raise ImproperlyConfigured('DB_PORT must be between 1 and 65535.')
        if not 1 <= self.EMAIL_PORT <= 65535:
            raise ImproperlyConfigured('DJANGO_EMAIL_PORT must be between 1 and 65535.')
        if bool(self.EMAIL_USERNAME) != bool(self.EMAIL_PASSWORD):
            raise ImproperlyConfigured(
                'DJANGO_EMAIL_USERNAME and DJANGO_EMAIL_PASSWORD must be set together.'
            )
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

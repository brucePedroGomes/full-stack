"""Local test defaults; PostgreSQL stays the same engine used by the app."""

import os

# Standalone test runs do not need the private application .env file.
# Keep these in the environment for the telemetry checks' child processes.
defaults = {
    'DJANGO_SECRET_KEY': 'test-only-django-secret-key-not-for-deployment',
    'DJANGO_JWT_SIGNING_KEY': 'test-only-jwt-signing-key-not-for-deployment',
    'DJANGO_PASSWORD_PEPPER': 'ab' * 32,
    'DJANGO_DEBUG': 'true',
    'DJANGO_ENABLE_API_DOCS': 'true',
    'DJANGO_SECURE_SSL_REDIRECT': 'false',
    'DJANGO_SESSION_COOKIE_SECURE': 'false',
    'DJANGO_CSRF_COOKIE_SECURE': 'false',
    'DJANGO_ALLOWED_HOSTS': '["testserver", "localhost", "127.0.0.1"]',
    'DJANGO_EMAIL_FROM': 'tests@example.com',
    'DJANGO_CACHE_URL': 'redis://127.0.0.1:6379/15',
    'CELERY_BROKER_URL': 'redis://127.0.0.1:6379/14',
    'DB_NAME': 'challenge',
    'DB_USER': 'challenge',
    'DB_PASSWORD': 'test-only-database-password',
    'DB_HOST': '127.0.0.1',
    'DB_PORT': '5439',
    'DB_SSLMODE': 'disable',
}
for name, value in defaults.items():
    os.environ.setdefault(name, value)

from config.settings import *

# API rate limit tests have their own cache and explicit rates. Other tests
# should not share counters with the app that is running beside the suite.
CACHES = {  # pyright: ignore[reportConstantRedefinition]
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'test-suite',
    },
}

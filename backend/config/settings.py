"""Django settings loaded from environment variables."""

import os
from datetime import timedelta

from config import common_settings
from config.environment import Env

BASE_DIR = common_settings.BASE_DIR
env = Env.model_validate(os.environ)


# Django
SECRET_KEY = env.DJANGO_SECRET_KEY
DEBUG = env.DJANGO_DEBUG
ALLOWED_HOSTS = env.DJANGO_ALLOWED_HOSTS


# Security
SESSION_COOKIE_SECURE = env.DJANGO_SESSION_COOKIE_SECURE
CSRF_COOKIE_SECURE = env.DJANGO_CSRF_COOKIE_SECURE
CSRF_TRUSTED_ORIGINS = env.DJANGO_CSRF_TRUSTED_ORIGINS
SECURE_SSL_REDIRECT = env.DJANGO_SECURE_SSL_REDIRECT

# Keep health checks available over HTTP.
SECURE_REDIRECT_EXEMPT = [r'^health/(live|ready)/$']

# The trusted proxy must replace this header.
if env.DJANGO_TRUST_PROXY:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SECURE_HSTS_SECONDS = env.DJANGO_SECURE_HSTS_SECONDS
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS
SECURE_HSTS_PRELOAD = env.DJANGO_SECURE_HSTS_PRELOAD


# Apps and routes
INSTALLED_APPS = common_settings.INSTALLED_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

if not DEBUG:
    # WhiteNoise must follow SecurityMiddleware.
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env.DB_NAME,
        'USER': env.DB_USER,
        'PASSWORD': env.DB_PASSWORD,
        'HOST': env.DB_HOST,
        'PORT': env.DB_PORT,
        'OPTIONS': {
            'sslmode': env.DB_SSLMODE,
        },
    }
}

if env.DB_SSLROOTCERT:
    DATABASES['default']['OPTIONS']['sslrootcert'] = env.DB_SSLROOTCERT


# Redis cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': env.DJANGO_CACHE_URL,
    },
}


# Passwords
PASSWORD_PEPPER = env.DJANGO_PASSWORD_PEPPER
ARGON2_TIME_COST = env.DJANGO_ARGON2_TIME_COST
ARGON2_MEMORY_COST = env.DJANGO_ARGON2_MEMORY_COST
ARGON2_PARALLELISM = env.DJANGO_ARGON2_PARALLELISM
PASSWORD_HASHERS = [
    'config.hashers.ConfigurableArgon2PasswordHasher',
]

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# API
SIMPLE_JWT = {
    'SIGNING_KEY': env.DJANGO_JWT_SIGNING_KEY,
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
}

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/min',
        'user': '120/min',
        'auth': '10/min',
        'auth_csr': '60/min',
    },
    'NUM_PROXIES': env.DJANGO_NUM_PROXIES,
}

if DEBUG:
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'].append(
        'rest_framework.renderers.BrowsableAPIRenderer'
    )

ENABLE_API_DOCS = env.DJANGO_ENABLE_API_DOCS
SPECTACULAR_SETTINGS = {
    'TITLE': 'Challenge API',
    'VERSION': '0.1.0',
    'OAS_VERSION': '3.2.1',
    'SERVE_INCLUDE_SCHEMA': False,
    'SWAGGER_UI_DIST': 'SIDECAR',
    'SWAGGER_UI_FAVICON_HREF': 'SIDECAR',
}


# Email
if DEBUG:
    default_mailer = {'BACKEND': 'django.core.mail.backends.console.EmailBackend'}
else:
    default_mailer = {
        'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
        'OPTIONS': {
            'host': env.DJANGO_EMAIL_HOST,
            'port': env.DJANGO_EMAIL_PORT,
            'username': env.DJANGO_EMAIL_USERNAME,
            'password': env.DJANGO_EMAIL_PASSWORD,
            'use_tls': env.DJANGO_EMAIL_USE_TLS,
            'timeout': 10,
        },
    }

MAILERS = {'default': default_mailer}
DEFAULT_FROM_EMAIL = env.DJANGO_EMAIL_FROM
SERVER_EMAIL = env.DJANGO_EMAIL_FROM


# Celery
CELERY_BROKER_URL = env.CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TASK_IGNORE_RESULT = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_TRANSPORT_OPTIONS = {
    'socket_connect_timeout': 2,
    'socket_timeout': 2,
}
CELERY_TASK_PUBLISH_RETRY_POLICY = {
    'max_retries': 2,
    'interval_start': 0,
    'interval_step': 0.2,
    'interval_max': 0.2,
}


# Language and time
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files
STATIC_URL = common_settings.STATIC_URL
STATIC_ROOT = common_settings.STATIC_ROOT
STORAGES = common_settings.STORAGES


# Keep console logs in Docker. Worker startup adds the OTLP handler when enabled.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': [], 'level': 'INFO', 'propagate': True},
    },
}

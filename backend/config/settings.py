"""Django settings loaded from environment variables."""

from config import common_settings
from config.environment import Env

BASE_DIR = common_settings.BASE_DIR
env = Env()


# Security

# Supply secrets at runtime; keep them out of the image.
SECRET_KEY = env.SECRET_KEY

# Debug helps locally but exposes details in production.
DEBUG = env.DEBUG
ENABLE_API_DOCS = env.ENABLE_API_DOCS

ALLOWED_HOSTS = env.ALLOWED_HOSTS

# Allow local HTTP; require HTTPS by default when debug is off.
SESSION_COOKIE_SECURE = env.SESSION_COOKIE_SECURE
CSRF_COOKIE_SECURE = env.CSRF_COOKIE_SECURE
SECURE_SSL_REDIRECT = env.SECURE_SSL_REDIRECT
# Allow HTTP probes; these routes return no private data.
SECURE_REDIRECT_EXEMPT = [r'^health/(live|ready)/$']

# Trust this header only when the proxy controls it.
if env.TRUST_PROXY:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# HSTS enforces HTTPS; enable it only after testing the domain.
SECURE_HSTS_SECONDS = env.SECURE_HSTS_SECONDS
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.SECURE_HSTS_INCLUDE_SUBDOMAINS
SECURE_HSTS_PRELOAD = env.SECURE_HSTS_PRELOAD
CSRF_TRUSTED_ORIGINS = env.CSRF_TRUSTED_ORIGINS


# Apps and middleware

INSTALLED_APPS = common_settings.INSTALLED_APPS

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
    'NUM_PROXIES': env.NUM_PROXIES,
}

CACHES = {
    'default': {
        'BACKEND': (
            'django.core.cache.backends.redis.RedisCache'
            if env.CACHE_URL else 'django.core.cache.backends.locmem.LocMemCache'
        ),
        'LOCATION': env.CACHE_URL or 'challenge-api',
    },
}

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

if DEBUG:
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'].append(
        'rest_framework.renderers.BrowsableAPIRenderer'
    )

SPECTACULAR_SETTINGS = {
    'TITLE': 'Challenge API',
    'VERSION': '0.1.0',
    'OAS_VERSION': '3.2.1',
    'SERVE_INCLUDE_SCHEMA': False,
    'SWAGGER_UI_DIST': 'SIDECAR',
    'SWAGGER_UI_FAVICON_HREF': 'SIDECAR',
}

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
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

ROOT_URLCONF = 'config.urls'

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

WSGI_APPLICATION = 'config.wsgi.application'


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


# Password checks

PASSWORD_PEPPER = env.PASSWORD_PEPPER
ARGON2_TIME_COST = env.ARGON2_TIME_COST
ARGON2_MEMORY_COST = env.ARGON2_MEMORY_COST
ARGON2_PARALLELISM = env.ARGON2_PARALLELISM
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


# Language and time

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files

STATIC_URL = common_settings.STATIC_URL
STATIC_ROOT = common_settings.STATIC_ROOT
STORAGES = common_settings.STORAGES


if DEBUG:
    default_mailer = {'BACKEND': 'django.core.mail.backends.console.EmailBackend'}
else:
    default_mailer = {
        'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
        'OPTIONS': {
            'host': env.EMAIL_HOST,
            'port': env.EMAIL_PORT,
            'username': env.EMAIL_USERNAME,
            'password': env.EMAIL_PASSWORD,
            'use_tls': env.EMAIL_USE_TLS,
            'timeout': 10,
        },
    }

MAILERS = {'default': default_mailer}
DEFAULT_FROM_EMAIL = env.EMAIL_FROM
SERVER_EMAIL = env.EMAIL_FROM

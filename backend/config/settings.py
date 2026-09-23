"""Django settings loaded from environment variables."""

from pathlib import Path

from config.environment import Env

BASE_DIR = Path(__file__).resolve().parent.parent
env = Env()


# Security

# Supply secrets at runtime; keep them out of the image.
SECRET_KEY = env.SECRET_KEY

# Debug helps locally but exposes details in production.
DEBUG = env.DEBUG

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

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'users.apps.UsersConfig',
]

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
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

STATIC_URL = 'static/'


# Print email locally; this does not send messages.

MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}

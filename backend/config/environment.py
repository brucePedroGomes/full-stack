"""Validate the application's environment variables."""

from typing import Self

from pydantic import BaseModel, ConfigDict, Field, Json, model_validator


class Env(BaseModel):
    """Declare types, required values, and limits for application settings."""

    model_config = ConfigDict(
        extra='ignore',  # Ignore unrelated variables, such as PATH.
        hide_input_in_errors=True,
    )

    # Django
    DJANGO_SECRET_KEY: str = Field(pattern=r'\S', repr=False)
    DJANGO_JWT_SIGNING_KEY: str = Field(min_length=32, pattern=r'\S', repr=False)
    DJANGO_PASSWORD_PEPPER: str = Field(pattern=r'^[0-9a-fA-F]{64}$', repr=False)
    DJANGO_DEBUG: bool = False
    DJANGO_ALLOWED_HOSTS: Json[list[str]] = Field(default_factory=list)
    DJANGO_CACHE_URL: str = Field(pattern=r'^rediss?://\S+$', repr=False)

    # Safe defaults. Set local HTTP and API docs explicitly in .env.
    DJANGO_ENABLE_API_DOCS: bool = False
    DJANGO_SESSION_COOKIE_SECURE: bool = True
    DJANGO_CSRF_COOKIE_SECURE: bool = True
    DJANGO_SECURE_SSL_REDIRECT: bool = True

    # Proxy, HTTPS, and password hashing
    DJANGO_NUM_PROXIES: int = Field(default=0, ge=0)
    DJANGO_TRUST_PROXY: bool = False
    DJANGO_SECURE_HSTS_SECONDS: int = Field(default=0, ge=0)
    DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS: bool = False
    DJANGO_SECURE_HSTS_PRELOAD: bool = False
    DJANGO_CSRF_TRUSTED_ORIGINS: Json[list[str]] = Field(default_factory=list)
    DJANGO_ARGON2_TIME_COST: int = Field(default=2, gt=0)
    DJANGO_ARGON2_MEMORY_COST: int = Field(default=102400, gt=0)
    DJANGO_ARGON2_PARALLELISM: int = Field(default=8, gt=0)

    # Email and background jobs
    DJANGO_EMAIL_HOST: str = ''
    DJANGO_EMAIL_FROM: str = Field(pattern=r'\S')
    DJANGO_EMAIL_PORT: int = Field(default=587, ge=1, le=65535)
    DJANGO_EMAIL_USERNAME: str = ''
    DJANGO_EMAIL_PASSWORD: str = Field(default='', repr=False)
    DJANGO_EMAIL_USE_TLS: bool = True
    CELERY_BROKER_URL: str = Field(pattern=r'^rediss?://\S+$', repr=False)

    # Database
    DB_NAME: str = Field(pattern=r'\S')
    DB_USER: str = Field(pattern=r'\S')
    DB_PASSWORD: str = Field(pattern=r'\S', repr=False)
    DB_HOST: str = Field(pattern=r'\S')
    DB_PORT: int = Field(default=5432, ge=1, le=65535)
    DB_SSLMODE: str = 'prefer'
    DB_SSLROOTCERT: str = ''

    @model_validator(mode='after')
    def check_related_settings(self) -> Self:
        if not self.DJANGO_DEBUG and not self.DJANGO_EMAIL_HOST.strip():
            raise ValueError('DJANGO_EMAIL_HOST is required outside debug mode.')

        if bool(self.DJANGO_EMAIL_USERNAME) != bool(self.DJANGO_EMAIL_PASSWORD):
            raise ValueError(
                'DJANGO_EMAIL_USERNAME and DJANGO_EMAIL_PASSWORD must be set together.'
            )

        if self.DJANGO_PASSWORD_PEPPER == self.DJANGO_SECRET_KEY:
            raise ValueError('DJANGO_PASSWORD_PEPPER must be different from DJANGO_SECRET_KEY.')

        if self.DJANGO_JWT_SIGNING_KEY in (
            self.DJANGO_SECRET_KEY, self.DJANGO_PASSWORD_PEPPER
        ):
            raise ValueError(
                'DJANGO_JWT_SIGNING_KEY must be different from '
                'DJANGO_SECRET_KEY and DJANGO_PASSWORD_PEPPER.'
            )

        if self.DJANGO_ARGON2_MEMORY_COST < 8 * self.DJANGO_ARGON2_PARALLELISM:
            raise ValueError(
                'DJANGO_ARGON2_MEMORY_COST must be at least '
                '8 times DJANGO_ARGON2_PARALLELISM (in KiB).'
            )
        return self

Backend

The backend is a JSON API for the task board. It stores users and tasks, and sends an email when a task is assigned. Every signed-in teammate can see and change every task. Anonymous users get nothing.\
It uses [Django](django.md) with [Django REST framework](https://www.django-rest-framework.org/).

- [Simple JWT](https://django-rest-framework-simplejwt.readthedocs.io/en/latest/)
- [django-filter](https://django-filter.readthedocs.io/en/stable/)
- [drf-spectacular](drf-spectacular.md)
- [Pydantic](https://docs.pydantic.dev/latest/)
- [Argon2](https://docs.djangoproject.com/en/6.1/topics/auth/passwords/#using-argon2-with-django)
- [PostgreSQL](https://www.postgresql.org/docs/17/)
- [psycopg](https://www.psycopg.org/psycopg3/docs/)
- [Redis](https://redis.io/docs/latest/)
- [Celery](https://docs.celeryq.dev/en/stable/)
- [Gunicorn](https://gunicorn.org/)
- [WhiteNoise](https://whitenoise.readthedocs.io/en/stable/)
- [OpenTelemetry](https://opentelemetry.io/docs/languages/python/)
- [Grafana](https://grafana.com/docs/grafana/latest/)
- [uv](https://docs.astral.sh/uv/)
- [Pyright](https://microsoft.github.io/pyright/)

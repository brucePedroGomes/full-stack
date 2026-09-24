"""Run background jobs with Django's settings."""

import os

from celery.app.base import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('challenge')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

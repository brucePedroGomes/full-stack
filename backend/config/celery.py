"""Run background jobs with Django's settings."""

import os

from celery.app.base import Celery
from celery.signals import worker_process_init, worker_process_shutdown

from config import telemetry

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('challenge')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@worker_process_init.connect(weak=False)
def initialize_worker_telemetry(**kwargs) -> None:
    if telemetry.setup():
        telemetry.setup_logging()


@worker_process_shutdown.connect(weak=False)
def shutdown_worker_telemetry(**kwargs) -> None:
    telemetry.shutdown()

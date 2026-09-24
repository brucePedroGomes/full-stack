"""Serve 8 requests at once with 2 workers and 4 threads each.

Initialize OpenTelemetry after fork, before Django builds its middleware.
"""

from opentelemetry.instrumentation.django import DjangoInstrumentor

from config import telemetry
from config.request_logging import log_response

workers = 2
threads = 4


def post_fork(server, worker) -> None:
    if telemetry.setup():
        DjangoInstrumentor().instrument(response_hook=log_response)


def post_worker_init(worker) -> None:
    telemetry.setup_logging()


def worker_exit(server, worker) -> None:
    telemetry.shutdown()

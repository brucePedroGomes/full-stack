"""Initialize OpenTelemetry after fork, before Django builds its middleware."""

from opentelemetry.instrumentation.django import DjangoInstrumentor  # pyright: ignore[reportMissingTypeStubs]

from config import telemetry
from config.request_logging import log_response


def post_fork(server, worker) -> None:
    if telemetry.setup():
        DjangoInstrumentor().instrument(response_hook=log_response)


def post_worker_init(worker) -> None:
    telemetry.setup_logging()


def worker_exit(server, worker) -> None:
    telemetry.shutdown()

"""Start OpenTelemetry inside each worker process, after fork."""

import logging
import os
from uuid import uuid4

from opentelemetry import metrics, trace
from opentelemetry._logs import get_logger_provider
from opentelemetry.distro import OpenTelemetryConfigurator, OpenTelemetryDistro  # pyright: ignore[reportMissingTypeStubs]
from opentelemetry.instrumentation.celery import CeleryInstrumentor  # pyright: ignore[reportMissingTypeStubs]
from opentelemetry.instrumentation.logging.handler import LoggingHandler  # pyright: ignore[reportMissingTypeStubs]
from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.trace import TracerProvider

_started = False


def setup() -> bool:
    """Leave CLI commands and deployments without an OTLP endpoint uninstrumented."""
    global _started
    if not os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT'):
        return False
    if os.environ.get('OTEL_SDK_DISABLED', '').lower() == 'true':
        return False
    if _started:
        return True

    os.environ.setdefault('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/protobuf')
    OpenTelemetryDistro().configure()
    OpenTelemetryConfigurator().configure(
        # Each worker needs its own metric stream.
        resource_attributes={'service.instance.id': str(uuid4())},
        setup_logging_handler=False,
    )
    PsycopgInstrumentor().instrument()
    RedisInstrumentor().instrument()
    CeleryInstrumentor().instrument()
    _started = True
    return True


def setup_logging() -> None:
    """Attach after Django/Celery configure logging, so their setup cannot remove it."""
    if not _started:
        return
    handler = LoggingHandler(level=logging.INFO, logger_provider=get_logger_provider())
    # Export failures should stay on the console, not feed back into the exporter.
    handler.addFilter(is_application_log)
    loggers = [logging.getLogger()]
    task_logger = logging.getLogger('celery.task')
    if not task_logger.propagate:
        loggers.append(task_logger)

    for logger in loggers:
        if not any(isinstance(item, LoggingHandler) for item in logger.handlers):
            logger.addHandler(handler)


def shutdown() -> None:
    """Flush before a Gunicorn or Celery child exits (including worker recycling)."""
    if not _started:
        return
    for provider in (
        trace.get_tracer_provider(),
        metrics.get_meter_provider(),
        get_logger_provider(),
    ):
        if isinstance(provider, (TracerProvider, MeterProvider, LoggerProvider)):
            provider.shutdown()


def is_application_log(record: logging.LogRecord) -> bool:
    return not record.name.startswith('opentelemetry')

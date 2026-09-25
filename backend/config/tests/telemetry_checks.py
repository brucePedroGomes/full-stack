"""Real instrumentation with in-memory exports, called by test_telemetry."""

import logging
import unittest
from unittest.mock import patch

from django.core.wsgi import get_wsgi_application
from django.test import Client, override_settings
from opentelemetry import metrics, trace
from opentelemetry._logs import get_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import Histogram, MetricExportResult, MetricsData, Sum
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from config import gunicorn, telemetry


class TelemetryChecks(unittest.TestCase):
    def setUp(self) -> None:
        self.spans = InMemorySpanExporter()
        self.logs = InMemoryLogRecordExporter()
        self.exported_metrics: list[MetricsData] = []
        self.enterContext(patch.object(OTLPSpanExporter, 'export', side_effect=self.spans.export))
        self.enterContext(patch.object(OTLPLogExporter, 'export', side_effect=self.logs.export))
        self.enterContext(patch.object(OTLPMetricExporter, 'export', side_effect=self.record_metrics))
        self.addCleanup(telemetry.shutdown)

    def record_metrics(self, data: MetricsData, **kwargs) -> MetricExportResult:
        self.exported_metrics.append(data)
        return MetricExportResult.SUCCESS

    def flush(self) -> None:
        for provider in (
            trace.get_tracer_provider(), metrics.get_meter_provider(), get_logger_provider(),
        ):
            assert isinstance(provider, (TracerProvider, MeterProvider, LoggerProvider))
            provider.force_flush()

    def test_request_trace_metric_and_log_share_context(self) -> None:
        gunicorn.post_fork(None, None)
        get_wsgi_application()
        gunicorn.post_worker_init(None)
        with override_settings(
            DEBUG=False, SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=['testserver'],
        ):
            client = Client()
            response = client.get('/api/does-not-exist/', {'search': 'private-value'})
            health = client.get('/health/ready/')
        self.flush()

        self.assertEqual(response.status_code, 404)
        self.assertEqual(health.status_code, 200)
        self.assertNotIn('X-Trace-Id', health)
        spans = self.spans.get_finished_spans()
        self.assertEqual(len(spans), 1)
        request_span = spans[0]
        assert request_span.context is not None
        assert request_span.attributes is not None
        trace_id = request_span.context.trace_id
        self.assertEqual(response['X-Trace-Id'], format(trace_id, '032x'))
        self.assertEqual(request_span.attributes['http.response.status_code'], 404)

        summaries = [
            item.log_record for item in self.logs.get_finished_logs()
            if item.log_record.body == 'GET unmatched → 404'
        ]
        self.assertEqual(len(summaries), 1)
        self.assertEqual(summaries[0].trace_id, trace_id)
        self.assertNotIn('private-value', str(summaries[0].attributes))
        self.assert_request_count(1)

    def assert_request_count(self, expected: int) -> None:
        self.assertTrue(self.exported_metrics)
        durations = []
        for resource in self.exported_metrics[-1].resource_metrics:
            for scope in resource.scope_metrics:
                for metric in scope.metrics:
                    if metric.name == 'http.server.request.duration':
                        durations.append(metric.data)
        self.assertEqual(len(durations), 1)
        duration = durations[0]
        assert isinstance(duration, Histogram)
        self.assertEqual(sum(point.count for point in duration.data_points), expected)

    def test_logging_does_not_duplicate_or_export_its_own_errors(self) -> None:
        telemetry.setup()
        provider = trace.get_tracer_provider()
        telemetry.setup()
        self.assertIs(trace.get_tracer_provider(), provider)

        # Celery task logs do not normally propagate to the root logger.
        logging.getLogger('celery.task').propagate = False
        logging.getLogger().setLevel(logging.INFO)
        telemetry.setup_logging()
        telemetry.setup_logging()
        logging.getLogger('tasks').info('application log')
        logging.getLogger('celery.task').info('task log')
        logging.getLogger('opentelemetry.exporter').error('export failed')
        self.flush()

        messages = [item.log_record.body for item in self.logs.get_finished_logs()]
        self.assertEqual(messages.count('application log'), 1)
        self.assertEqual(messages.count('task log'), 1)
        self.assertNotIn('export failed', messages)

    def test_process_cpu_and_memory_are_exported(self) -> None:
        telemetry.setup()
        self.flush()

        exported = {
            metric.name: metric.data
            for data in self.exported_metrics
            for resource in data.resource_metrics
            for scope in resource.scope_metrics
            for metric in scope.metrics
        }
        self.assertIn('process.cpu.utilization', exported)
        self.assertIn('process.memory.usage', exported)
        memory = exported['process.memory.usage']
        assert isinstance(memory, Sum)
        self.assertGreater(memory.data_points[0].value, 0)
        host_metrics = [name for name in exported if name.startswith('system.')]
        self.assertEqual(host_metrics, [])

    def test_telemetry_does_not_start(self) -> None:
        with patch.object(telemetry.OpenTelemetryConfigurator, 'configure') as configure:
            gunicorn.post_fork(None, None)
            gunicorn.post_worker_init(None)
            gunicorn.worker_exit(None, None)
        configure.assert_not_called()
        self.assertNotIsInstance(trace.get_tracer_provider(), TracerProvider)


if __name__ == '__main__':
    unittest.main()

"""Run each integration check in a fresh process: OpenTelemetry uses global state."""

import os
import subprocess
import sys

from django.test import SimpleTestCase


class TelemetryTests(SimpleTestCase):
    def test_request_trace_metric_and_log_share_context(self) -> None:
        self.run_check('test_request_trace_metric_and_log_share_context')

    def test_logging_does_not_duplicate_or_export_its_own_errors(self) -> None:
        self.run_check('test_logging_does_not_duplicate_or_export_its_own_errors')

    def test_process_cpu_and_memory_are_exported(self) -> None:
        self.run_check('test_process_cpu_and_memory_are_exported')

    def test_disabled_telemetry_does_not_start(self) -> None:
        self.run_check('test_telemetry_does_not_start', OTEL_SDK_DISABLED='true')

    def test_telemetry_without_an_endpoint_does_not_start(self) -> None:
        self.run_check('test_telemetry_does_not_start', OTEL_EXPORTER_OTLP_ENDPOINT='')

    def run_check(self, name: str, **environment: str) -> None:
        result = subprocess.run(
            [sys.executable, '-m', 'config.tests.telemetry_checks', f'TelemetryChecks.{name}'],
            env={
                **os.environ,
                'DJANGO_SETTINGS_MODULE': 'config.settings',
                'OTEL_EXPORTER_OTLP_ENDPOINT': 'http://unused.invalid:4318',
                'OTEL_EXPORTER_OTLP_PROTOCOL': 'http/protobuf',
                'OTEL_SDK_DISABLED': 'false',
                'OTEL_SEMCONV_STABILITY_OPT_IN': 'http',
                'OTEL_PYTHON_DJANGO_EXCLUDED_URLS': '/health/.*',
                **environment,
            },
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

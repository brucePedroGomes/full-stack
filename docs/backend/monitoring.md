Logs, metrics, and traces

I use [OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/) to find slow requests and understand errors. It collects data from Django and Celery. Grafana shows this data in one place. This helps me find which part of the app needs attention.\
Without this setup, I would have less detail about slow requests and errors.
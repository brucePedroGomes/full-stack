"""Link Django request summaries to their traces in Grafana."""

import logging

from django.http import HttpRequest, HttpResponse
from opentelemetry.trace import Span

logger = logging.getLogger(__name__)


def log_response(span: Span, request: HttpRequest, response: HttpResponse) -> None:
    """Record the route and status without bodies, cookies, or query parameters."""
    context = span.get_span_context()
    if context.is_valid:
        response['X-Trace-Id'] = format(context.trace_id, '032x')

    route = request.resolver_match.route if request.resolver_match else 'unmatched'
    level = logging.ERROR if response.status_code >= 500 else logging.INFO
    logger.log(
        level,
        '%s %s → %s', request.method, route, response.status_code,
        extra={
            'http.request.method': request.method,
            'http.route': route,
            'http.response.status_code': response.status_code,
        },
    )

from unittest.mock import patch

from django.core.cache import cache
from django.db import DatabaseError, connection
from django.test import SimpleTestCase, TestCase, override_settings
from redis.exceptions import RedisError

health_settings = override_settings(
    DEBUG=False,
    ALLOWED_HOSTS=['localhost'],
    SECURE_SSL_REDIRECT=True,
    SECURE_PROXY_SSL_HEADER=None,
)


@health_settings
class HealthTests(SimpleTestCase):
    """SimpleTestCase fails if the liveness check tries to use the database."""

    def test_liveness_returns_ok(self):
        """Liveness responds over HTTP, even when HTTPS is required elsewhere."""
        response = self.client.get('/health/live/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_head_is_allowed(self):
        """Let health clients check headers without a response body."""
        response = self.client.head('/health/live/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'')

    def test_post_is_not_allowed(self):
        """Keep health checks read only."""
        response = self.client.post('/health/live/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 405)

    def test_admin_still_requires_https(self):
        """The HTTP exception for health checks does not apply to admin."""
        response = self.client.get('/admin/login/', HTTP_HOST='localhost')
        self.assertRedirects(
            response, 'https://localhost/admin/login/',
            status_code=301, fetch_redirect_response=False,
        )


@health_settings
class ReadinessTests(TestCase):
    def test_readiness_returns_fresh_status(self):
        """Readiness responds over HTTP and prevents caching old results."""
        response = self.client.get('/health/ready/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
        self.assertIn('no-store', response.headers['Cache-Control'])

    def test_readiness_fails_when_the_database_is_down(self):
        """Report 503 so Docker marks the web container unhealthy."""
        with patch.object(connection, 'cursor', side_effect=DatabaseError('down')):
            response = self.client.get('/health/ready/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'unavailable'})

    def test_readiness_fails_when_redis_is_down(self):
        """Redis holds the job queue and the login rate limits."""
        with patch.object(cache, 'get', side_effect=RedisError('down')):
            response = self.client.get('/health/ready/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status': 'unavailable'})

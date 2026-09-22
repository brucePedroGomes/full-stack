from django.test import SimpleTestCase, override_settings


@override_settings(
    DEBUG=False,
    ALLOWED_HOSTS=['localhost'],
    SECURE_SSL_REDIRECT=True,
    SECURE_PROXY_SSL_HEADER=None,
)
class HealthTests(SimpleTestCase):
    """SimpleTestCase fails if a health check tries to use the database."""

    def test_liveness_returns_ok(self):
        """Liveness responds over HTTP, even when HTTPS is required elsewhere."""
        response = self.client.get('/health/live/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_readiness_returns_fresh_status(self):
        """Readiness responds over HTTP and prevents caching old results."""
        response = self.client.get('/health/ready/', HTTP_HOST='localhost')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
        self.assertIn('no-store', response.headers['Cache-Control'])

    def test_admin_still_requires_https(self):
        """The HTTP exception for health checks does not apply to admin."""
        response = self.client.get('/admin/login/', HTTP_HOST='localhost')
        self.assertRedirects(
            response, 'https://localhost/admin/login/',
            status_code=301, fetch_redirect_response=False,
        )

import json
from importlib import reload

from django.test import SimpleTestCase, override_settings
from django.urls import clear_url_caches, reverse

import config.urls


@override_settings(DEBUG=True, ENABLE_API_DOCS=True)
class SchemaTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        reload(config.urls)
        clear_url_caches()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        reload(config.urls)
        clear_url_caches()

    def test_swagger_ui_is_public(self):
        """Show the Swagger page when docs are enabled."""
        response = self.client.get(reverse('api-docs'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="swagger-ui"')

    def test_schema_documents_tasks_and_jwt_authentication(self):
        """Include task routes and JWT in the OpenAPI schema."""
        response = self.client.get(reverse('api-schema'), HTTP_ACCEPT='application/json')

        self.assertEqual(response.status_code, 200)
        schema = json.loads(response.content)
        self.assertEqual(schema['openapi'], '3.2.1')
        self.assertIn('/api/tasks/{id}/status/', schema['paths'])
        self.assertEqual(
            schema['components']['securitySchemes']['jwtAuth']['scheme'],
            'bearer',
        )
        filters = schema['paths']['/api/tasks/']['get']['parameters']
        self.assertIn('due_before', [parameter['name'] for parameter in filters])

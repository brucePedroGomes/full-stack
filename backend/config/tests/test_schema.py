import json

from django.test import SimpleTestCase
from django.urls import reverse


class SchemaTests(SimpleTestCase):
    def test_swagger_ui_is_public(self):
        response = self.client.get(reverse('api-docs'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="swagger-ui"')

    def test_schema_documents_tasks_and_jwt_authentication(self):
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

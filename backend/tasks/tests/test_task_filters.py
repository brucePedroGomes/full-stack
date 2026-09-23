from datetime import date

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from tasks.models import Task


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TaskFilterTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create(username='ana')
        self.client.force_authenticate(user=self.user)

    def test_filters_by_status_and_due_date_range(self):
        """Combine status and inclusive due date filters."""
        Task.objects.create(
            title='Planned', created_by=self.user, due_date=date(2026, 10, 10)
        )
        Task.objects.create(
            title='To Do', created_by=self.user,
            due_date=date(2026, 10, 11), status=Task.Status.TO_DO,
        )
        Task.objects.create(title='No deadline', created_by=self.user)

        response = self.client.get(reverse('tasks:list'), {
            'status': 'to_do',
            'due_after': '2026-10-11',
            'due_before': '2026-10-11',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [task['title'] for task in response.data['results']], ['To Do']
        )

    def test_filters_by_exact_due_date(self):
        """Match tasks due on one date."""
        Task.objects.create(
            title='Today', created_by=self.user, due_date=date(2026, 10, 10)
        )
        Task.objects.create(
            title='Tomorrow', created_by=self.user, due_date=date(2026, 10, 11)
        )

        response = self.client.get(
            reverse('tasks:list'), {'due_date': '2026-10-10'}
        )

        self.assertEqual(
            [task['title'] for task in response.data['results']], ['Today']
        )

    def test_rejects_invalid_filters(self):
        """Reject invalid or blank task filters."""
        url = reverse('tasks:list')
        invalid_filters = (
            {'status': 'unknown'},
            {'status': ''},
            {'due_date': 'tomorrow'},
            {'due_date': ''},
            {'due_after': ''},
            {'due_before': ''},
            {'due_after': '2026-10-12', 'due_before': '2026-10-11'},
        )

        for filters in invalid_filters:
            with self.subTest(filters=filters):
                self.assertEqual(self.client.get(url, filters).status_code, 400)

        response = self.client.get(url, {
            'due_after': '2026-10-12', 'due_before': '2026-10-11',
        })
        self.assertIn('due_after', response.data)

from datetime import date

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from tasks.models import Task


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TaskPaginationTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create(username='ana')
        self.client.force_authenticate(user=self.user)

    def test_lists_ten_tasks_per_page_by_default(self):
        """Return ten tasks on the first page."""
        Task.objects.bulk_create([
            Task(title=f'Task {number}', created_by=self.user)
            for number in range(21)
        ])

        first_page = self.client.get(reverse('tasks:list')).data
        second_page = self.client.get(first_page['next']).data
        third_page = self.client.get(second_page['next']).data

        self.assertEqual(first_page['count'], 21)
        self.assertEqual(len(first_page['results']), 10)
        self.assertEqual(len(second_page['results']), 10)
        self.assertEqual(len(third_page['results']), 1)
        self.assertIsNone(third_page['next'])

    def test_next_page_keeps_filters(self):
        """Keep filters when following the next page link."""
        for title, task_status, due_date in (
            ('First', Task.Status.DONE, date(2026, 10, 10)),
            ('Second', Task.Status.DONE, date(2026, 10, 11)),
            ('Planned', Task.Status.PLANNED, date(2026, 10, 10)),
            ('Too late', Task.Status.DONE, date(2026, 10, 12)),
        ):
            Task.objects.create(
                title=title, created_by=self.user,
                status=task_status, due_date=due_date,
            )

        first_page = self.client.get(reverse('tasks:list'), {
            'status': 'done', 'due_before': '2026-10-11', 'page_size': 1,
        }).data
        second_page = self.client.get(first_page['next']).data

        self.assertEqual(first_page['count'], 2)
        self.assertEqual(first_page['results'][0]['title'], 'First')
        self.assertEqual(second_page['results'][0]['title'], 'Second')
        self.assertIsNone(second_page['next'])

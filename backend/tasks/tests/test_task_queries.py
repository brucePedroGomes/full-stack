from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from tasks.models import Task


@override_settings(
    ALLOWED_HOSTS=['testserver'],
    SECURE_SSL_REDIRECT=False,
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'task-query-tests',
        },
    },
)
class TaskQueryTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create(username='ana')
        self.client.force_authenticate(user=self.user)
        self.tasks = Task.objects.bulk_create([
            Task(title=f'Task {number}', created_by=self.user, assigned_to=self.user)
            for number in range(25)
        ])
        # Include a different status and tied timestamps to check both filters
        # and deterministic ordering across page boundaries.
        Task.objects.create(title='Done', created_by=self.user, status=Task.Status.DONE)
        Task.objects.update(updated_at=timezone.now())

    def test_status_list_query_count_does_not_grow_with_page_size(self):
        """Count tasks and load each page with assignees in two queries."""
        for page_size in (1, 20, 100):
            with self.subTest(page_size=page_size):
                # Authentication is forced, so these are the task queries only.
                with self.assertNumQueries(2):
                    response = self.client.get(reverse('tasks:list'), {
                        'status': 'planned', 'page_size': page_size,
                    })

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['count'], len(self.tasks))
                self.assertEqual(
                    len(response.data['results']), min(page_size, len(self.tasks)),
                )
                for task in response.data['results']:
                    self.assertEqual(task['status'], 'planned')
                    self.assertEqual(task['assignee']['id'], self.user.pk)
                    self.assertEqual(task['assignee']['username'], 'ana')

    def test_status_pages_use_id_to_break_timestamp_ties(self):
        """Return tied tasks once each, ordered by descending ID."""
        first = self.client.get(reverse('tasks:list'), {'status': 'planned'}).data
        second = self.client.get(first['next']).data

        self.assertEqual(first['count'], len(self.tasks))
        self.assertIsNone(second['next'])
        self.assertEqual(
            [task['id'] for task in first['results'] + second['results']],
            [task.pk for task in reversed(self.tasks)],
        )

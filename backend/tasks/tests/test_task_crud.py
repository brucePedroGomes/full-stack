from datetime import date

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from tasks.models import Task


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TaskCrudTests(APITestCase):
    def setUp(self):
        self.creator = get_user_model().objects.create(username='creator')
        self.assignee = get_user_model().objects.create(
            username='assignee', first_name='Ana', last_name='Silva'
        )
        self.client.force_authenticate(user=self.creator)

    def test_create_task(self):
        """Create a planned task for the current user."""
        response = self.client.post(
            reverse('tasks:list'),
            {
                'title': 'Write report',
                'assigned_to': self.assignee.pk,
                'created_by': self.assignee.pk,
                'status': 'done',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(pk=response.data['id'])
        self.assertEqual(task.created_by, self.creator)
        self.assertEqual(task.assigned_to, self.assignee)
        self.assertEqual(task.status, Task.Status.PLANNED)

    def test_read_task(self):
        """Return a task by its ID."""
        task = Task.objects.create(title='Write report', created_by=self.creator)

        response = self.client.get(reverse('tasks:detail', args=[task.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Write report')

    def test_put_updates_task(self):
        """Replace editable task fields with PUT."""
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.put(
            reverse('tasks:detail', args=[task.pk]),
            {
                'title': 'Final report',
                'due_date': '2026-10-11',
                'assigned_to': self.assignee.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.title, 'Final report')
        self.assertEqual(task.due_date, date(2026, 10, 11))
        self.assertEqual(task.assigned_to, self.assignee)

    def test_status_route_accepts_all_statuses(self):
        """Accept each defined task status."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        url = reverse('tasks:status', args=[task.pk])

        for status in Task.Status.values:
            with self.subTest(status=status):
                response = self.client.patch(url, {'status': status}, format='json')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['status'], status)
                task.refresh_from_db()
                self.assertEqual(task.status, status)

    def test_regular_task_route_cannot_change_status(self):
        """Keep status changes on the status route."""
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.patch(
            reverse('tasks:detail', args=[task.pk]),
            {'title': 'Updated', 'status': 'done'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.title, 'Updated')
        self.assertEqual(task.status, Task.Status.PLANNED)

    def test_status_route_changes_only_status(self):
        """Ignore other fields when changing status."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        url = reverse('tasks:status', args=[task.pk])

        response = self.client.patch(
            url, {'status': 'blocked', 'title': 'Changed'}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.BLOCKED)
        self.assertEqual(task.title, 'Draft')

    def test_status_route_rejects_put(self):
        """Allow status changes only through PATCH."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        url = reverse('tasks:status', args=[task.pk])
        self.assertEqual(self.client.put(url, {'status': 'done'}).status_code, 405)

    def test_status_route_rejects_invalid_status(self):
        """Reject unknown task statuses."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        url = reverse('tasks:status', args=[task.pk])

        for data in (
            {'status': 'pending'},
            {'status': 'completed'},
            {'status': 'unknown'},
        ):
            with self.subTest(data=data):
                response = self.client.patch(url, data, format='json')
                self.assertEqual(response.status_code, 400)

        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.PLANNED)

    def test_status_route_requires_status(self):
        """Require a status value even for a partial update."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        response = self.client.patch(
            reverse('tasks:status', args=[task.pk]), {}, format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('status', response.data)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.PLANNED)

    def test_patch_clears_assignee(self):
        """Allow a task's assignee to be removed."""
        task = Task.objects.create(
            title='Draft', created_by=self.creator, assigned_to=self.assignee
        )

        response = self.client.patch(
            reverse('tasks:detail', args=[task.pk]),
            {'assigned_to': None},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertIsNone(task.assigned_to)

    def test_delete_task(self):
        """Delete a task by its ID."""
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.delete(reverse('tasks:detail', args=[task.pk]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Task.objects.filter(pk=task.pk).exists())

    def test_rejects_blank_title(self):
        """Reject a task without a title."""
        self.assertEqual(
            self.client.post(
                reverse('tasks:list'), {'title': ''}, format='json'
            ).status_code,
            400,
        )

    def test_rejects_unknown_assignee(self):
        """Reject an assignee who does not exist."""
        self.assertEqual(
            self.client.post(
                reverse('tasks:list'), {'title': 'Draft', 'assigned_to': 99999},
                format='json',
            ).status_code,
            400,
        )

    def test_includes_assignee_names_without_extra_queries_per_task(self) -> None:
        """Keep card names available without loading the user directory."""
        Task.objects.bulk_create([
            Task(title=f'Task {index}', created_by=self.creator, assigned_to=self.assignee)
            for index in range(10)
        ])
        with self.assertNumQueries(2):
            response = self.client.get(reverse('tasks:list'))
        self.assertEqual(response.data['results'][0]['assignee'], {
            'id': self.assignee.pk, 'username': 'assignee',
            'first_name': 'Ana', 'last_name': 'Silva',
        })
        detail = self.client.patch(
            reverse('tasks:detail', args=[response.data['results'][0]['id']]),
            {'assigned_to': None, 'assignee': {'id': self.creator.pk}}, format='json',
        )
        self.assertIsNone(detail.data['assigned_to'])
        self.assertIsNone(detail.data['assignee'])

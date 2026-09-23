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
        self.assignee = get_user_model().objects.create(username='assignee')
        self.client.force_authenticate(user=self.creator)

    def test_create_task(self):
        response = self.client.post(
            reverse('tasks:list'),
            {
                'title': 'Write report',
                'assigned_to': self.assignee.pk,
                'created_by': self.assignee.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(pk=response.data['id'])
        self.assertEqual(task.created_by, self.creator)
        self.assertEqual(task.assigned_to, self.assignee)
        self.assertEqual(task.status, Task.Status.PENDING)

    def test_read_task(self):
        task = Task.objects.create(title='Write report', created_by=self.creator)

        response = self.client.get(reverse('tasks:detail', args=[task.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Write report')

    def test_put_updates_task(self):
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

    def test_patch_updates_status(self):
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.patch(
            reverse('tasks:detail', args=[task.pk]),
            {'status': 'completed'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.COMPLETED)

    def test_delete_task(self):
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.delete(reverse('tasks:detail', args=[task.pk]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Task.objects.filter(pk=task.pk).exists())

    def test_rejects_invalid_task_data(self):
        url = reverse('tasks:list')

        self.assertEqual(
            self.client.post(url, {'title': ''}, format='json').status_code, 400
        )
        self.assertEqual(
            self.client.post(
                url, {'title': 'Draft', 'assigned_to': 99999}, format='json'
            ).status_code,
            400,
        )

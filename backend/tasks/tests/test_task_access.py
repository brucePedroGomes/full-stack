from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from tasks.models import Task


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TaskAccessTests(APITestCase):
    def setUp(self):
        self.creator = get_user_model().objects.create(username='creator')
        self.teammate = get_user_model().objects.create(username='teammate')
        self.client.force_authenticate(user=self.teammate)

    def test_teammate_can_list_all_tasks(self):
        """Allow any team member to list tasks."""
        first = Task.objects.create(title='Assigned', created_by=self.creator)
        second = Task.objects.create(title='Unassigned', created_by=self.creator)

        response = self.client.get(reverse('tasks:list'))

        self.assertEqual(
            [item['id'] for item in response.data['results']],
            [second.pk, first.pk],
        )

    def test_teammate_can_read_task(self):
        """Allow a team member to read another user's task."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        response = self.client.get(reverse('tasks:detail', args=[task.pk]))
        self.assertEqual(response.status_code, 200)

    def test_teammate_can_edit_and_assign_task(self):
        """Allow a team member to edit and assign another user's task."""
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.patch(
            reverse('tasks:detail', args=[task.pk]),
            {'title': 'Ready', 'assigned_to': self.teammate.pk},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.title, 'Ready')
        self.assertEqual(task.assigned_to, self.teammate)
        self.assertEqual(task.created_by, self.creator)

    def test_teammate_can_change_task_status(self):
        """Allow a team member to change task status."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        status_url = reverse('tasks:status', args=[task.pk])

        response = self.client.patch(
            status_url, {'status': 'in_progress'}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.IN_PROGRESS)

    def test_teammate_can_delete_task(self):
        """Allow a team member to delete another user's task."""
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.delete(reverse('tasks:detail', args=[task.pk]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Task.objects.filter(pk=task.pk).exists())

    def test_anonymous_user_cannot_access_tasks(self):
        """Require a token for every task action."""
        task = Task.objects.create(title='Draft', created_by=self.creator)
        detail_url = reverse('tasks:detail', args=[task.pk])
        self.client.force_authenticate(user=None)

        for method, url in (
            ('GET', reverse('tasks:list')),
            ('POST', reverse('tasks:list')),
            ('GET', detail_url),
            ('PUT', detail_url),
            ('PATCH', detail_url),
            ('DELETE', detail_url),
            ('PATCH', reverse('tasks:status', args=[task.pk])),
        ):
            with self.subTest(method=method, url=url):
                self.assertEqual(self.client.generic(method, url).status_code, 401)

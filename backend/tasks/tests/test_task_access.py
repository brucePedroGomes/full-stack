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

    def test_teammate_can_list_and_read_all_tasks(self):
        """Allow any team member to list and read tasks."""
        first = Task.objects.create(title='Assigned', created_by=self.creator)
        second = Task.objects.create(title='Unassigned', created_by=self.creator)

        response = self.client.get(reverse('tasks:list'))

        self.assertEqual(
            [item['id'] for item in response.data['results']],
            [first.pk, second.pk],
        )
        self.assertEqual(
            self.client.get(reverse('tasks:detail', args=[second.pk])).status_code,
            200,
        )

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

        self.assertEqual(self.client.get(reverse('tasks:list')).status_code, 401)
        self.assertEqual(
            self.client.post(
                reverse('tasks:list'), {'title': 'New'}, format='json'
            ).status_code,
            401,
        )
        self.assertEqual(self.client.get(detail_url).status_code, 401)
        self.assertEqual(
            self.client.patch(detail_url, {'title': 'Changed'}, format='json').status_code,
            401,
        )
        self.assertEqual(self.client.delete(detail_url).status_code, 401)
        self.assertEqual(
            self.client.patch(
                reverse('tasks:status', args=[task.pk]),
                {'status': 'done'}, format='json',
            ).status_code,
            401,
        )

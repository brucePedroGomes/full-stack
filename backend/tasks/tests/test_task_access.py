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

    def test_teammate_can_complete_task(self):
        task = Task.objects.create(title='Draft', created_by=self.creator)
        complete_url = reverse('tasks:complete', args=[task.pk])

        self.assertEqual(self.client.post(complete_url).status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.COMPLETED)
        updated_at = task.updated_at

        self.assertEqual(self.client.post(complete_url).status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.updated_at, updated_at)

    def test_teammate_can_delete_task(self):
        task = Task.objects.create(title='Draft', created_by=self.creator)

        response = self.client.delete(reverse('tasks:detail', args=[task.pk]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Task.objects.filter(pk=task.pk).exists())

    def test_anonymous_user_cannot_access_tasks(self):
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
            self.client.post(reverse('tasks:complete', args=[task.pk])).status_code,
            401,
        )

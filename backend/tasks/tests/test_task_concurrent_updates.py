from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from tasks.models import Task
from tasks.views import TaskDetailView, TaskStatusView


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TaskConcurrentUpdateTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create(username='editor')
        self.assignee = User.objects.create(username='assignee', email='assignee@example.com')
        self.client.force_authenticate(self.user)
        self.task = Task.objects.create(title='Draft', created_by=self.user)

    def test_edit_keeps_a_status_saved_after_the_request_loaded_the_task(self) -> None:
        """Editing a title must not move a completed task back to Planned."""
        stale = Task.objects.get(pk=self.task.pk)
        Task.objects.filter(pk=self.task.pk).update(status=Task.Status.DONE)
        with patch.object(TaskDetailView, 'get_object', return_value=stale):
            response = self.client.patch(
                reverse('tasks:detail', args=[self.task.pk]),
                {'title': 'Final'}, format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, 'Final')
        self.assertEqual(self.task.status, Task.Status.DONE)
        self.assertEqual(response.data['status'], Task.Status.DONE)

    def test_status_change_keeps_newer_title_and_assignment(self) -> None:
        """Moving a stale card must not undo another teammate's edit."""
        stale = Task.objects.get(pk=self.task.pk)
        Task.objects.filter(pk=self.task.pk).update(title='Final', assigned_to=self.assignee)
        with patch.object(TaskStatusView, 'get_object', return_value=stale):
            response = self.client.patch(
                reverse('tasks:status', args=[self.task.pk]),
                {'status': 'done'}, format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, Task.Status.DONE)
        self.assertEqual(self.task.title, 'Final')
        self.assertEqual(self.task.assigned_to, self.assignee)

    def test_repeated_assignment_does_not_queue_another_email(self) -> None:
        """Compare the assignment with the saved row, not an earlier copy."""
        stale = Task.objects.get(pk=self.task.pk)
        Task.objects.filter(pk=self.task.pk).update(assigned_to=self.assignee)
        with patch('tasks.serializers.send_assignment_email.delay') as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                with patch.object(TaskDetailView, 'get_object', return_value=stale):
                    response = self.client.patch(
                        reverse('tasks:detail', args=[self.task.pk]),
                        {'assigned_to': self.assignee.pk}, format='json',
                    )
            self.assertEqual(response.status_code, 200)
            enqueue.assert_not_called()

    def test_edit_does_not_recreate_a_deleted_task(self) -> None:
        """Return 404 when deletion wins the race with either update route."""
        for view, route, values in (
            (TaskDetailView, 'tasks:detail', {'title': 'Final'}),
            (TaskStatusView, 'tasks:status', {'status': 'done'}),
        ):
            with self.subTest(route=route):
                stale = Task.objects.get(pk=self.task.pk)
                Task.objects.filter(pk=self.task.pk).delete()
                with patch.object(view, 'get_object', return_value=stale):
                    response = self.client.patch(
                        reverse(route, args=[self.task.pk]), values, format='json',
                    )
                self.assertEqual(response.status_code, 404)
                self.assertFalse(Task.objects.filter(pk=self.task.pk).exists())
                self.task = Task.objects.create(title='Draft', created_by=self.user)

from datetime import date
from smtplib import SMTPException
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.db import transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from kombu.exceptions import OperationalError
from rest_framework.test import APITestCase

from tasks.models import Task
from tasks.tasks import send_assignment_email


@override_settings(
    ALLOWED_HOSTS=['testserver'],
    SECURE_SSL_REDIRECT=False,
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
)
class AssignmentQueueTests(APITestCase):
    def setUp(self):
        self.creator = get_user_model().objects.create(username='creator')
        self.assignee = get_user_model().objects.create(
            username='ana', email='ana@example.com',
        )
        self.client.force_authenticate(user=self.creator)
        enqueue = patch('tasks.serializers.send_assignment_email.delay')
        self.enqueue = enqueue.start()
        self.addCleanup(enqueue.stop)

    def test_create_queues_after_commit_without_sending_email(self):
        """Return the saved task and leave email delivery to the worker."""
        with self.captureOnCommitCallbacks() as callbacks:
            response = self.client.post(
                reverse('tasks:list'),
                {'title': 'Report', 'assigned_to': self.assignee.pk}, format='json',
            )
            self.assertEqual(response.status_code, 201)
            self.enqueue.assert_not_called()
            self.assertEqual(len(mail.outbox), 0)

        self.assertEqual(len(callbacks), 1)
        callbacks[0]()
        self.enqueue.assert_called_once_with(response.data['id'], self.assignee.pk)
        self.assertEqual(len(mail.outbox), 0)

    def test_redis_error_is_logged_and_keeps_the_saved_task(self):
        """A broker outage must not turn a saved task into a server error."""
        self.enqueue.side_effect = OperationalError('Redis is down')
        with self.assertLogs(level='ERROR'):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('tasks:list'),
                    {'title': 'Report', 'assigned_to': self.assignee.pk}, format='json',
                )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Task.objects.filter(pk=response.data['id']).exists())

    def test_patch_and_put_queue_new_assignment(self):
        """Both editing routes notify a newly selected assignee."""
        for method in (self.client.patch, self.client.put):
            with self.subTest(method=method.__name__):
                self.enqueue.reset_mock()
                task = Task.objects.create(title='Draft', created_by=self.creator)
                with self.captureOnCommitCallbacks(execute=True):
                    response = method(
                        reverse('tasks:detail', args=[task.pk]),
                        {'title': 'Report', 'assigned_to': self.assignee.pk},
                        format='json',
                    )
                self.assertEqual(response.status_code, 200)
                self.enqueue.assert_called_once_with(task.pk, self.assignee.pk)

    def test_reassignment_notifies_only_the_new_assignee(self):
        """Use the new recipient when moving a task between people."""
        task = Task.objects.create(
            title='Draft', created_by=self.creator, assigned_to=self.assignee,
        )
        teammate = get_user_model().objects.create(
            username='bruno', email='bruno@example.com',
        )
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                reverse('tasks:detail', args=[task.pk]),
                {'assigned_to': teammate.pk}, format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.enqueue.assert_called_once_with(task.pk, teammate.pk)

    def test_other_edits_and_unassignment_do_not_queue_email(self):
        """Send emails only for new assignments."""
        task = Task.objects.create(
            title='Draft', created_by=self.creator, assigned_to=self.assignee,
        )
        for values in (
            {'title': 'New title'},
            {'assigned_to': self.assignee.pk},
            {'assigned_to': None},
        ):
            with self.subTest(values=values):
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.patch(
                        reverse('tasks:detail', args=[task.pk]), values, format='json',
                    )
                self.assertEqual(response.status_code, 200)
                self.enqueue.assert_not_called()

    def test_status_change_does_not_queue_email(self):
        """Changing status does not repeat an assignment email."""
        task = Task.objects.create(
            title='Draft', created_by=self.creator, assigned_to=self.assignee,
        )
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                reverse('tasks:status', args=[task.pk]), {'status': 'done'}, format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.enqueue.assert_not_called()

    def test_create_without_recipient_does_not_queue_email(self):
        """Skip unassigned tasks and users without an email address."""
        for assignee_id in (None, self.creator.pk):
            with self.subTest(assignee_id=assignee_id):
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post(
                        reverse('tasks:list'),
                        {'title': 'Draft', 'assigned_to': assignee_id}, format='json',
                    )
                self.assertEqual(response.status_code, 201)
                self.enqueue.assert_not_called()

    def test_invalid_assignment_does_not_queue_email(self):
        """Rejected writes cannot create email jobs."""
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse('tasks:list'),
                {'title': '', 'assigned_to': self.assignee.pk}, format='json',
            )
        self.assertEqual(response.status_code, 400)
        self.enqueue.assert_not_called()

    def test_rollback_discards_email_job(self):
        """Do not send an email for a task that was never committed."""
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with transaction.atomic():
                response = self.client.post(
                    reverse('tasks:list'),
                    {'title': 'Draft', 'assigned_to': self.assignee.pk}, format='json',
                )
                self.assertEqual(response.status_code, 201)
                transaction.set_rollback(True)
        self.assertEqual(callbacks, [])
        self.enqueue.assert_not_called()
        self.assertFalse(Task.objects.exists())


@override_settings(
    DEFAULT_FROM_EMAIL='tasks@example.com',
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
)
class AssignmentEmailTests(TestCase):
    def setUp(self):
        self.creator = get_user_model().objects.create(username='creator')
        self.assignee = get_user_model().objects.create(
            username='ana', first_name='Ana', last_name='Silva', email='ana@example.com',
        )
        self.task = Task.objects.create(
            title='Write report', description='Include the latest results.',
            due_date=date(2026, 10, 11), created_by=self.creator, assigned_to=self.assignee,
        )

    def test_worker_sends_task_details_to_assignee(self):
        """Deliver one message with the saved task details."""
        send_assignment_email.run(self.task.pk, self.assignee.pk)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['ana@example.com'])
        self.assertEqual(message.from_email, 'tasks@example.com')
        self.assertEqual(message.subject, 'Task assigned: Write report')
        for text in ('Hi Ana Silva,', 'Write report', 'Include the latest results.', '2026-10-11'):
            self.assertIn(text, message.body)

    def test_worker_skips_stale_assignment(self):
        """Do not email the previous assignee after reassignment or removal."""
        for assignee in (self.creator, None):
            with self.subTest(assignee=assignee):
                Task.objects.filter(pk=self.task.pk).update(assigned_to=assignee)
                send_assignment_email.run(self.task.pk, self.assignee.pk)
        self.assertEqual(len(mail.outbox), 0)

    def test_worker_skips_deleted_task(self):
        """A queued job is harmless if its task has been deleted."""
        task_id = self.task.pk
        self.task.delete()
        send_assignment_email.run(task_id, self.assignee.pk)
        self.assertEqual(len(mail.outbox), 0)

    def test_worker_skips_missing_email(self):
        """Respect an email address removed after the job was queued."""
        get_user_model().objects.filter(pk=self.assignee.pk).update(email='')
        send_assignment_email.run(self.task.pk, self.assignee.pk)
        self.assertEqual(len(mail.outbox), 0)

    def test_worker_handles_newlines_in_title_and_optional_fields(self):
        """Keep user text out of email headers and support a minimal task."""
        self.task.title = 'Report\r\nfor Monday'
        self.task.description = ''
        self.task.due_date = None
        self.task.save()
        send_assignment_email.run(self.task.pk, self.assignee.pk)
        self.assertEqual(mail.outbox[0].subject, 'Task assigned: Report for Monday')
        self.assertNotIn('Due date:', mail.outbox[0].body)

    def test_worker_retries_email_failure(self):
        """Recover from SMTP and connection errors without involving the API."""
        for error in (SMTPException('Temporary SMTP failure'), OSError('Connection lost')):
            with self.subTest(error=error):
                with patch('tasks.tasks.send_mail', side_effect=[error, 1]) as send:
                    result = send_assignment_email.apply(
                        args=(self.task.pk, self.assignee.pk), throw=False,
                    )
                self.assertTrue(result.successful())
                self.assertEqual(send.call_count, 2)

    def test_worker_stops_retrying_after_five_retries(self):
        """Leave persistent delivery failures visible in the worker."""
        with patch('tasks.tasks.send_mail', side_effect=SMTPException('SMTP unavailable')) as send:
            result = send_assignment_email.apply(
                args=(self.task.pk, self.assignee.pk), throw=False,
            )
        self.assertTrue(result.failed())
        self.assertEqual(send.call_count, 6)

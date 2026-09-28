import threading
from datetime import date, timedelta
from smtplib import SMTPException
from unittest.mock import call, patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.db import DatabaseError, connection, transaction
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from kombu.exceptions import OperationalError
from rest_framework.test import APIClient, APITestCase

from tasks.models import OutboxMessage, Task
from tasks.tasks import purge_dispatched_outbox, relay_outbox, send_assignment_email

EMAIL_TASK = send_assignment_email.name


@override_settings(
    ALLOWED_HOSTS=['testserver'],
    SECURE_SSL_REDIRECT=False,
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
)
class AssignmentOutboxTests(APITestCase):
    def setUp(self):
        self.creator = get_user_model().objects.create(username='creator')
        self.assignee = get_user_model().objects.create(
            username='ana', email='ana@example.com',
        )
        self.client.force_authenticate(user=self.creator)
        publish = patch.object(relay_outbox.app, 'send_task')
        self.publish = publish.start()
        self.addCleanup(publish.stop)

    def assertQueued(self, *jobs: tuple[int, int]) -> None:
        self.assertEqual(
            list(OutboxMessage.objects.values_list('task_name', 'kwargs', 'dispatched_at')),
            [
                (EMAIL_TASK, {'task_id': task_id, 'assignee_id': assignee_id}, None)
                for task_id, assignee_id in jobs
            ],
        )

    def test_create_saves_the_email_job_without_touching_redis(self):
        """The API writes to Postgres only; the relay talks to Redis later."""
        response = self.client.post(
            reverse('tasks:list'),
            {'title': 'Report', 'assigned_to': self.assignee.pk}, format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertQueued((response.data['id'], self.assignee.pk))
        self.publish.assert_not_called()
        self.assertEqual(len(mail.outbox), 0)

    def test_redis_outage_does_not_lose_the_email_job(self):
        """A broker outage cannot drop a job, because the API never calls Redis."""
        self.publish.side_effect = OperationalError('Redis is down')
        response = self.client.post(
            reverse('tasks:list'),
            {'title': 'Report', 'assigned_to': self.assignee.pk}, format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertQueued((response.data['id'], self.assignee.pk))

    def test_patch_and_put_queue_new_assignment(self):
        """Both editing routes notify a newly selected assignee."""
        for method in (self.client.patch, self.client.put):
            with self.subTest(method=method.__name__):
                OutboxMessage.objects.all().delete()
                task = Task.objects.create(title='Draft', created_by=self.creator)
                response = method(
                    reverse('tasks:detail', args=[task.pk]),
                    {'title': 'Report', 'assigned_to': self.assignee.pk},
                    format='json',
                )
                self.assertEqual(response.status_code, 200)
                self.assertQueued((task.pk, self.assignee.pk))

    def test_reassignment_notifies_only_the_new_assignee(self):
        """Use the new recipient when moving a task between people."""
        task = Task.objects.create(
            title='Draft', created_by=self.creator, assigned_to=self.assignee,
        )
        teammate = get_user_model().objects.create(
            username='bruno', email='bruno@example.com',
        )
        response = self.client.patch(
            reverse('tasks:detail', args=[task.pk]),
            {'assigned_to': teammate.pk}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertQueued((task.pk, teammate.pk))

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
                response = self.client.patch(
                    reverse('tasks:detail', args=[task.pk]), values, format='json',
                )
                self.assertEqual(response.status_code, 200)
                self.assertQueued()

    def test_status_change_does_not_queue_email(self):
        """Changing status does not repeat an assignment email."""
        task = Task.objects.create(
            title='Draft', created_by=self.creator, assigned_to=self.assignee,
        )
        response = self.client.patch(
            reverse('tasks:status', args=[task.pk]), {'status': 'done'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertQueued()

    def test_create_without_recipient_does_not_queue_email(self):
        """Skip unassigned tasks and users without an email address."""
        for assignee_id in (None, self.creator.pk):
            with self.subTest(assignee_id=assignee_id):
                response = self.client.post(
                    reverse('tasks:list'),
                    {'title': 'Draft', 'assigned_to': assignee_id}, format='json',
                )
                self.assertEqual(response.status_code, 201)
                self.assertQueued()

    def test_invalid_assignment_does_not_queue_email(self):
        """Rejected writes cannot create email jobs."""
        response = self.client.post(
            reverse('tasks:list'),
            {'title': '', 'assigned_to': self.assignee.pk}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertQueued()

    def test_rollback_discards_email_job(self):
        """The task and its job commit together, or neither is saved."""
        with transaction.atomic():
            response = self.client.post(
                reverse('tasks:list'),
                {'title': 'Draft', 'assigned_to': self.assignee.pk}, format='json',
            )
            self.assertEqual(response.status_code, 201)
            transaction.set_rollback(True)
        self.assertFalse(Task.objects.exists())
        self.assertQueued()

    def test_failed_job_write_does_not_save_the_task(self):
        """If the job cannot be saved, the new task is not saved either."""
        with patch.object(OutboxMessage.objects, 'create', side_effect=DatabaseError):
            with self.assertLogs('django.request', 'ERROR'), self.assertRaises(DatabaseError):
                self.client.post(
                    reverse('tasks:list'),
                    {'title': 'Draft', 'assigned_to': self.assignee.pk}, format='json',
                )
        self.assertFalse(Task.objects.exists())


class RelayOutboxTests(TestCase):
    def setUp(self):
        publish = patch.object(relay_outbox.app, 'send_task')
        self.publish = publish.start()
        self.addCleanup(publish.stop)

    def queue(self, count: int) -> list[OutboxMessage]:
        return [
            OutboxMessage.objects.create(
                task_name=EMAIL_TASK, kwargs={'task_id': n, 'assignee_id': n},
            )
            for n in range(1, count + 1)
        ]

    def pending(self) -> list[int]:
        return list(
            OutboxMessage.objects.filter(dispatched_at__isnull=True)
            .values_list('pk', flat=True),
        )

    def test_relay_sends_pending_jobs_in_order_once(self):
        """Each job goes to Redis one time, oldest first."""
        self.queue(2)
        self.assertEqual(relay_outbox.run(), 2)
        self.assertEqual(self.publish.call_args_list, [
            call(EMAIL_TASK, kwargs={'task_id': 1, 'assignee_id': 1}),
            call(EMAIL_TASK, kwargs={'task_id': 2, 'assignee_id': 2}),
        ])
        self.assertEqual(self.pending(), [])

        self.publish.reset_mock()
        self.assertEqual(relay_outbox.run(), 0)
        self.publish.assert_not_called()

    def test_broker_error_keeps_unsent_jobs_for_the_next_run(self):
        """Jobs sent before the outage are done; the rest wait for Redis."""
        _, second, third = self.queue(3)
        self.publish.side_effect = [None, OperationalError('Redis is down')]
        with self.assertLogs('tasks.tasks', level='WARNING'):
            self.assertEqual(relay_outbox.run(), 1)
        self.assertEqual(self.pending(), [second.pk, third.pk])

        self.publish.side_effect = None
        self.assertEqual(relay_outbox.run(), 2)
        self.assertEqual(self.pending(), [])
        self.assertEqual(self.publish.call_count, 4)

    def test_relay_sends_at_most_one_batch_per_run(self):
        """A large backlog is split across runs."""
        self.queue(3)
        with patch('tasks.tasks.OUTBOX_BATCH_SIZE', 2):
            self.assertEqual(relay_outbox.run(), 2)
            self.assertEqual(relay_outbox.run(), 1)

    def test_purge_deletes_only_old_dispatched_jobs(self):
        """Keep pending jobs and recent history."""
        old, recent, pending = self.queue(3)
        now = timezone.now()
        OutboxMessage.objects.filter(pk=old.pk).update(dispatched_at=now - timedelta(days=8))
        OutboxMessage.objects.filter(pk=recent.pk).update(dispatched_at=now - timedelta(days=1))
        self.assertEqual(purge_dispatched_outbox.run(), 1)
        self.assertEqual(
            list(OutboxMessage.objects.values_list('pk', flat=True)), [recent.pk, pending.pk],
        )

    def test_beat_runs_the_relay_and_the_purge(self):
        """The CELERY_ settings reach the Celery app under its own names."""
        schedule = relay_outbox.app.conf.beat_schedule
        self.assertEqual(schedule['relay-outbox']['task'], relay_outbox.name)
        self.assertEqual(
            schedule['purge-dispatched-outbox']['task'], purge_dispatched_outbox.name,
        )

    @override_settings(
        ALLOWED_HOSTS=['testserver'],
        SECURE_SSL_REDIRECT=False,
        MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
    )
    def test_api_to_email_through_the_outbox(self):
        """A new assignment reaches the assignee's inbox through the relay."""
        creator = get_user_model().objects.create(username='creator')
        assignee = get_user_model().objects.create(username='ana', email='ana@example.com')
        client = APIClient()
        client.force_authenticate(user=creator)
        response = client.post(
            reverse('tasks:list'), {'title': 'Report', 'assigned_to': assignee.pk},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

        relay_outbox.run()
        (name,), options = self.publish.call_args
        self.assertEqual(name, send_assignment_email.name)
        send_assignment_email.run(**options['kwargs'])
        self.assertEqual(mail.outbox[0].to, ['ana@example.com'])


class RelayOutboxLockTests(TransactionTestCase):
    def test_parallel_relay_skips_rows_another_relay_holds(self):
        """Two relays at once do not send the same job twice."""
        held, free = (
            OutboxMessage.objects.create(task_name=EMAIL_TASK, kwargs={'task_id': n})
            for n in (1, 2)
        )
        locked, release = threading.Event(), threading.Event()

        def other_relay() -> None:
            try:
                with transaction.atomic():
                    OutboxMessage.objects.select_for_update().get(pk=held.pk)
                    locked.set()
                    release.wait(timeout=10)
            finally:
                connection.close()

        thread = threading.Thread(target=other_relay)
        thread.start()
        try:
            self.assertTrue(locked.wait(timeout=10))
            with patch.object(relay_outbox.app, 'send_task') as publish:
                self.assertEqual(relay_outbox.run(), 1)
            publish.assert_called_once_with(EMAIL_TASK, kwargs={'task_id': 2})
        finally:
            release.set()
            thread.join()
        free.refresh_from_db()
        held.refresh_from_db()
        self.assertIsNotNone(free.dispatched_at)
        self.assertIsNone(held.dispatched_at)


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

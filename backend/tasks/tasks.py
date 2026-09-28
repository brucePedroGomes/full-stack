"""Email and outbox jobs handled by the Celery worker."""

import logging
from datetime import timedelta
from smtplib import SMTPException

from celery import Task as CeleryTask, shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from kombu.exceptions import OperationalError

from .models import OutboxMessage, Task

logger = logging.getLogger(__name__)

OUTBOX_BATCH_SIZE = 100
OUTBOX_KEEP_DISPATCHED = timedelta(days=7)


@shared_task(
    autoretry_for=(SMTPException, OSError),
    retry_backoff=10,
    retry_backoff_max=300,
    max_retries=5,
    ignore_result=True,
)
def send_assignment_email(task_id: int, assignee_id: int) -> None:
    """Notify the assignee if the task still belongs to them."""
    task = Task.objects.select_related('assigned_to').filter(
        pk=task_id, assigned_to_id=assignee_id,
    ).first()
    if task is None or task.assigned_to is None or not task.assigned_to.email:
        return

    assignee = task.assigned_to
    name = assignee.get_full_name() or assignee.username
    subject_title = ' '.join(task.title.splitlines())
    message = f'Hi {name},\n\nYou have been assigned this task:\n\n{task.title}\n'
    if task.description:
        message += f'\n{task.description}\n'
    if task.due_date:
        message += f'\nDue date: {task.due_date.isoformat()}\n'

    send_mail(
        subject=f'Task assigned: {subject_title}',
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[assignee.email],
    )


@shared_task(bind=True, ignore_result=True)
def relay_outbox(self: 'CeleryTask[[], int]') -> int:
    """Send saved jobs to Redis; rows stay pending until Redis accepts them."""
    sent: list[int] = []
    with transaction.atomic():
        # skip_locked lets a second relay run take other rows instead of waiting.
        messages = OutboxMessage.objects.filter(
            dispatched_at__isnull=True,
        ).select_for_update(skip_locked=True)[:OUTBOX_BATCH_SIZE]
        for message in messages:
            try:
                self.app.send_task(message.task_name, kwargs=message.kwargs)
            except OperationalError:
                logger.warning('Outbox relay stopped: the broker is not available.')
                break
            sent.append(message.pk)
        # Mark only what Redis accepted, so a broker error does not resend it.
        OutboxMessage.objects.filter(pk__in=sent).update(dispatched_at=timezone.now())
    return len(sent)


@shared_task(ignore_result=True)
def purge_dispatched_outbox() -> int:
    """Delete sent rows after a week, so the table stays small."""
    deleted, _ = OutboxMessage.objects.filter(
        dispatched_at__lt=timezone.now() - OUTBOX_KEEP_DISPATCHED,
    ).delete()
    return deleted

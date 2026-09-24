"""Email jobs handled by the Celery worker."""

from smtplib import SMTPException

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .models import Task


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

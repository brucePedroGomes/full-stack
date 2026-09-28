from datetime import date, datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector
from django.db import models
from django.db.models import Q
from django.utils import timezone

# The search filter must use this same vector, or PostgreSQL skips the index.
TASK_SEARCH_VECTOR = SearchVector('title', 'description', config='english')


class Task(models.Model):
    class Status(models.TextChoices):
        PLANNED = 'planned'
        TO_DO = 'to_do'
        IN_PROGRESS = 'in_progress'
        BLOCKED = 'blocked'
        DONE = 'done'

    title: models.CharField[str, str] = models.CharField(max_length=200)
    description: models.TextField[str, str] = models.TextField(blank=True)
    due_date: models.DateField[date | None, date | None] = models.DateField(
        null=True, blank=True
    )
    status: models.CharField[str, str] = models.CharField(
        max_length=11, choices=Status.choices, default=Status.PLANNED
    )
    created_by: models.ForeignKey[User, User] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_tasks',
    )
    assigned_to: models.ForeignKey[User | None, User | None] = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='assigned_tasks',
        null=True,
        blank=True,
    )
    created_at: models.DateTimeField[datetime | None, datetime | None] = (
        models.DateTimeField(auto_now_add=True)
    )
    updated_at: models.DateTimeField[datetime | None, datetime | None] = (
        models.DateTimeField(auto_now=True)
    )

    class Meta:
        ordering = ['id']
        indexes = [
            # Match the board's status filter and newest-change-first order.
            models.Index(
                fields=['status', '-updated_at', '-id'],
                name='task_status_updated_id_idx',
            ),
            GinIndex(TASK_SEARCH_VECTOR, name='task_search_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    status__in=['planned', 'to_do', 'in_progress', 'blocked', 'done']
                ),
                name='task_valid_status',
            ),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def is_overdue(self) -> bool:
        return (
            self.due_date is not None
            and self.due_date < timezone.localdate()
            and self.status != self.Status.DONE
        )


class OutboxMessage(models.Model):
    """A Celery job saved in the same transaction as the change that needs it."""

    task_name: models.CharField[str, str] = models.CharField(max_length=200)
    kwargs: models.JSONField[dict[str, object], dict[str, object]] = models.JSONField()
    created_at: models.DateTimeField[datetime | None, datetime | None] = (
        models.DateTimeField(auto_now_add=True)
    )
    dispatched_at: models.DateTimeField[datetime | None, datetime | None] = (
        models.DateTimeField(null=True, blank=True)
    )

    class Meta:
        ordering = ['id']
        indexes = [
            # The relay only reads messages that have not been sent yet.
            models.Index(
                fields=['id'],
                condition=Q(dispatched_at__isnull=True),
                name='outbox_pending_idx',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.task_name} #{self.pk}'

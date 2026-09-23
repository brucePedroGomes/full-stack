from datetime import date, datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q


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
        on_delete=models.CASCADE,
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

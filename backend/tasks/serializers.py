from functools import partial
from typing import Any

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers

from users.serializers import UserSummarySerializer
from .models import Task
from .tasks import send_assignment_email


class TaskSerializer(serializers.ModelSerializer[Task]):
    assignee = UserSummarySerializer(source='assigned_to', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'due_date', 'status',
            'created_by', 'assigned_to', 'assignee', 'created_at', 'updated_at',
            'is_overdue',
        ]
        read_only_fields = ['id', 'status', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data: dict[str, Any]) -> Task:
        """Queue an email once the new task has been committed."""
        task = super().create(validated_data)
        self._queue_assignment_email(task)
        return task

    @transaction.atomic
    def update(self, instance: Task, validated_data: dict[str, Any]) -> Task:
        """Lock the current row so overlapping edits keep unrelated changes."""
        instance = get_object_or_404(
            Task.objects.select_related('assigned_to').select_for_update(of=('self',)),
            pk=instance.pk,
        )
        previous_assignee = instance.assigned_to
        task = super().update(instance, validated_data)
        if task.assigned_to != previous_assignee:
            self._queue_assignment_email(task)
        return task

    @staticmethod
    def _queue_assignment_email(task: Task) -> None:
        """Pass IDs to Redis; the worker loads the saved task."""
        if task.assigned_to is not None and task.assigned_to.email:
            transaction.on_commit(
                partial(send_assignment_email.delay, task.pk, task.assigned_to.pk),
                robust=True,
            )


class TaskCreateSerializer(TaskSerializer):
    class Meta(TaskSerializer.Meta):
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class TaskStatusSerializer(serializers.ModelSerializer[Task]):
    class Meta:
        model = Task
        fields = ['status']

    @transaction.atomic
    def update(self, instance: Task, validated_data: dict[str, Any]) -> Task:
        """Do not overwrite newer fields or recreate a concurrently deleted row."""
        instance = get_object_or_404(Task.objects.select_for_update(), pk=instance.pk)
        return super().update(instance, validated_data)

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        """Require status even when PATCH makes serializer fields optional."""
        if 'status' not in attrs:
            raise serializers.ValidationError({'status': 'This field is required.'})
        return attrs

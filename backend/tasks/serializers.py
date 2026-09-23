from rest_framework import serializers

from users.serializers import UserSummarySerializer
from .models import Task


class TaskSerializer(serializers.ModelSerializer[Task]):
    assignee = UserSummarySerializer(source='assigned_to', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'due_date', 'status',
            'created_by', 'assigned_to', 'assignee', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'created_by', 'created_at', 'updated_at']


class TaskStatusSerializer(serializers.ModelSerializer[Task]):
    class Meta:
        model = Task
        fields = ['status']

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        """Require status even when PATCH makes serializer fields optional."""
        if 'status' not in attrs:
            raise serializers.ValidationError({'status': 'This field is required.'})
        return attrs

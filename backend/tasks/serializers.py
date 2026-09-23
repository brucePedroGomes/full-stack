from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(), allow_null=True, required=False
    )

    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = Task
        fields = [
            'id', 'title', 'description', 'due_date', 'status',
            'created_by', 'assigned_to', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        assignee = validated_data.pop('assigned_to', None)
        return Task.objects.create(assigned_to=assignee, **validated_data)

    def update(self, instance, validated_data):
        if 'assigned_to' in validated_data:
            instance.assigned_to = validated_data.pop('assigned_to')
        return super().update(instance, validated_data)


class TaskFilterSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Task.Status.choices, required=False)
    due_date = serializers.DateField(required=False)
    due_before = serializers.DateField(required=False)
    due_after = serializers.DateField(required=False)

    def validate(self, attrs):
        if (
            'due_before' in attrs and 'due_after' in attrs
            and attrs['due_after'] > attrs['due_before']
        ):
            raise serializers.ValidationError(
                {'due_after': 'Must be on or before due_before.'}
            )
        return attrs

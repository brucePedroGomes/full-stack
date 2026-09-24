from datetime import date, timedelta

from django import forms
from django.db.models import QuerySet
from django.utils import timezone
from django_filters import rest_framework as filters

from .models import Task


class TaskFilterForm(forms.Form):
    def clean(self) -> dict[str, object]:
        """Reject blank filters and a date range in reverse order."""
        cleaned_data = super().clean() or {}
        for name in ('status', 'due_date', 'due_after', 'due_before', 'assigned_to'):
            if self.data.get(name) == '':
                self.add_error(name, 'This field may not be blank.')

        due_after = cleaned_data.get('due_after')
        due_before = cleaned_data.get('due_before')
        if (
            isinstance(due_after, date)
            and isinstance(due_before, date)
            and due_after > due_before
        ):
            self.add_error('due_after', 'Must be on or before due_before.')
        return cleaned_data


class TaskFilter(filters.FilterSet):
    unassigned = filters.BooleanFilter(field_name='assigned_to', lookup_expr='isnull')
    due_after = filters.DateFilter(field_name='due_date', lookup_expr='gte')
    due_before = filters.DateFilter(field_name='due_date', lookup_expr='lte')
    due = filters.ChoiceFilter(
        choices=[('overdue', 'Overdue'), ('next7', 'Next 7 days')],
        method='filter_due',
    )

    class Meta:
        model = Task
        fields = ['status', 'due_date', 'assigned_to']
        form = TaskFilterForm

    def filter_due(self, queryset: QuerySet[Task], name: str, value: str) -> QuerySet[Task]:
        today = timezone.localdate()
        if value == 'overdue':
            return queryset.filter(due_date__lt=today).exclude(status=Task.Status.DONE)
        return queryset.filter(due_date__range=(today, today + timedelta(days=6)))

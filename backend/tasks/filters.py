from datetime import date

from django import forms
from django_filters import rest_framework as filters

from .models import Task


class TaskFilterForm(forms.Form):
    def clean(self) -> dict[str, object]:
        cleaned_data = super().clean() or {}
        for name in ('status', 'due_date', 'due_after', 'due_before'):
            if name in self.data and self.data.get(name) == '':
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
    due_after = filters.DateFilter(field_name='due_date', lookup_expr='gte')
    due_before = filters.DateFilter(field_name='due_date', lookup_expr='lte')

    class Meta:
        model = Task
        fields = ['status', 'due_date']
        form = TaskFilterForm

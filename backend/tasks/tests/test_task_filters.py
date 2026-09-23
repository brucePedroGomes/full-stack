from datetime import date

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from tasks.models import Task


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class TaskFilterTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create(username='ana')
        self.client.force_authenticate(user=self.user)

    def test_filters_by_status_and_due_date_range(self):
        """Combine status and inclusive due date filters."""
        Task.objects.create(
            title='Planned', created_by=self.user, due_date=date(2026, 10, 10)
        )
        Task.objects.create(
            title='To Do', created_by=self.user,
            due_date=date(2026, 10, 11), status=Task.Status.TO_DO,
        )
        Task.objects.create(title='No deadline', created_by=self.user)

        response = self.client.get(reverse('tasks:list'), {
            'status': 'to_do',
            'due_after': '2026-10-11',
            'due_before': '2026-10-11',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [task['title'] for task in response.data['results']], ['To Do']
        )

    def test_filters_by_exact_due_date(self):
        """Match tasks due on one date."""
        Task.objects.create(
            title='Today', created_by=self.user, due_date=date(2026, 10, 10)
        )
        Task.objects.create(
            title='Tomorrow', created_by=self.user, due_date=date(2026, 10, 11)
        )

        response = self.client.get(
            reverse('tasks:list'), {'due_date': '2026-10-10'}
        )

        self.assertEqual(
            [task['title'] for task in response.data['results']], ['Today']
        )

    def test_rejects_invalid_filters(self):
        """Reject invalid or blank task filters."""
        url = reverse('tasks:list')
        invalid_filters = (
            {'status': 'unknown'},
            {'status': ''},
            {'due_date': 'tomorrow'},
            {'due_date': ''},
            {'due_after': ''},
            {'due_before': ''},
            {'assigned_to': ''},
            {'assigned_to': 'not-a-user'},
            {'assigned_to': 999999},
        )

        for filters in invalid_filters:
            with self.subTest(filters=filters):
                self.assertEqual(self.client.get(url, filters).status_code, 400)

    def test_filters_by_assignee_instead_of_creator(self) -> None:
        """Match assigned tasks and allow the existing status filter."""
        teammate = get_user_model().objects.create(username='bruno')
        assigned = Task.objects.create(
            title='Assigned to Ana', created_by=teammate,
            assigned_to=self.user, status=Task.Status.IN_PROGRESS,
        )
        Task.objects.create(title='Created by Ana', created_by=self.user, assigned_to=teammate)
        response = self.client.get(reverse('tasks:list'), {
            'assigned_to': self.user.pk, 'status': 'in_progress',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual([task['id'] for task in response.data['results']], [assigned.pk])

    def test_filters_unassigned_tasks(self) -> None:
        """Return tasks without an assignee when requested."""
        unassigned = Task.objects.create(title='Unassigned', created_by=self.user)
        Task.objects.create(title='Assigned', created_by=self.user, assigned_to=self.user)
        response = self.client.get(reverse('tasks:list'), {'unassigned': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([task['id'] for task in response.data['results']], [unassigned.pk])

    def test_rejects_reversed_date_range(self):
        """Reject a range whose start comes after its end."""
        response = self.client.get(reverse('tasks:list'), {
            'due_after': '2026-10-12', 'due_before': '2026-10-11',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('due_after', response.data)

    def test_searches_title_and_description_before_pagination(self) -> None:
        """Search all matching tasks while keeping status and assignee filters."""
        title_match = Task.objects.create(
            title='Release notes', created_by=self.user, assigned_to=self.user,
        )
        description_match = Task.objects.create(
            title='Write update', description='Notes for the release',
            created_by=self.user, assigned_to=self.user,
        )
        Task.objects.create(title='Release notes', created_by=self.user)
        Task.objects.create(
            title='Release notes', created_by=self.user,
            assigned_to=self.user, status=Task.Status.DONE,
        )
        filters = {
            'search': 'RELEASE notes', 'status': 'planned',
            'assigned_to': self.user.pk, 'page_size': 1, 'ordering': '-id',
        }
        first = self.client.get(reverse('tasks:list'), filters)
        second = self.client.get(reverse('tasks:list'), {**filters, 'page': 2})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['count'], 2)
        self.assertIsNotNone(first.data['next'])
        self.assertEqual(first.data['results'][0]['id'], description_match.pk)
        self.assertEqual(second.data['results'][0]['id'], title_match.pk)
        self.assertIsNone(second.data['next'])

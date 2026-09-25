from django.contrib.auth import get_user_model
from django.db.models import ProtectedError
from django.test import TestCase

from tasks.models import Task


class TaskModelTests(TestCase):
    def test_deleting_a_creator_keeps_their_tasks(self) -> None:
        """Block deleting a user who created tasks, instead of deleting the tasks too."""
        creator = get_user_model().objects.create(username='creator')
        task = Task.objects.create(title='Keep me', created_by=creator)

        with self.assertRaises(ProtectedError):
            creator.delete()

        self.assertTrue(Task.objects.filter(pk=task.pk).exists())

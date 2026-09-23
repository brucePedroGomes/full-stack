from io import StringIO

from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from tasks.management.commands.seed_demo import DEMO_PASSWORD, SEED_GROUP, TEAM
from tasks.models import Task


@override_settings(
    DEBUG=True,
    PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'],
)
class SeedDemoTests(TestCase):
    def test_creates_varied_tasks_without_changing_existing_data(self) -> None:
        """Create the default demo dataset while keeping existing records."""
        owner = User.objects.create_user(username='existing')
        original = Task.objects.create(title='Keep this task', created_by=owner)

        call_command('seed_demo', stdout=StringIO())

        users = User.objects.filter(groups__name=SEED_GROUP)
        tasks = Task.objects.exclude(pk=original.pk)
        self.assertEqual(users.count(), 15)
        self.assertEqual(tasks.count(), 2000)
        self.assertFalse(users.filter(is_staff=True).exists())
        self.assertFalse(users.filter(is_superuser=True).exists())
        self.assertTrue(users.get(username='ana').check_password(DEMO_PASSWORD))
        self.assertSetEqual(set(tasks.values_list('status', flat=True)), set(Task.Status.values))
        self.assertTrue(tasks.filter(assigned_to__isnull=True).exists())
        self.assertTrue(tasks.filter(due_date__isnull=True).exists())
        self.assertTrue(tasks.filter(due_date__lt=timezone.localdate()).exists())
        self.assertTrue(tasks.filter(due_date__gt=timezone.localdate()).exists())
        self.assertFalse(users.filter(username__startswith='demo.').exists())
        self.assertSetEqual(
            set(users.values_list('first_name', 'last_name')),
            {(first.capitalize(), last) for first, last in TEAM},
        )
        for user in users:
            self.assertTrue(tasks.filter(assigned_to=user).exists())
        original.refresh_from_db()
        self.assertEqual(original.title, 'Keep this task')

    def test_second_run_preserves_edits_and_does_not_duplicate_data(self) -> None:
        """Leave edited demo records untouched on the next run."""
        call_command('seed_demo', tasks=10, stdout=StringIO())
        task = Task.objects.earliest('id')
        task.title = 'An edited demo task'
        task.save()
        user = User.objects.get(username='ana')
        user.first_name = 'Anna'
        user.last_name = 'Updated'
        user.save()

        call_command('seed_demo', stdout=StringIO())

        self.assertEqual(Task.objects.count(), 10)
        self.assertEqual(User.objects.count(), 15)
        task.refresh_from_db()
        self.assertEqual(task.title, 'An edited demo task')
        user.refresh_from_db()
        self.assertEqual(user.get_full_name(), 'Anna Updated')

    @override_settings(DEBUG=False)
    def test_rejects_seeding_outside_development(self) -> None:
        """Do not create demo accounts with production settings."""
        with self.assertRaisesMessage(CommandError, 'DEBUG=True'):
            call_command('seed_demo', stdout=StringIO())
        self.assertFalse(Group.objects.filter(name=SEED_GROUP).exists())

    def test_rejects_invalid_counts_and_username_collisions(self) -> None:
        """Reject invalid input without leaving a partial seed."""
        for count in (0, -1):
            with self.assertRaisesMessage(CommandError, 'positive integer'):
                call_command('seed_demo', tasks=count, stdout=StringIO())
        User.objects.create_user(username='ana', password='keep-this-password')
        with self.assertRaisesMessage(CommandError, 'username already exists'):
            call_command('seed_demo', stdout=StringIO())
        self.assertFalse(Group.objects.filter(name=SEED_GROUP).exists())
        self.assertEqual(User.objects.count(), 1)
        self.assertTrue(User.objects.get().check_password('keep-this-password'))

    def test_renames_old_seed_users_without_changing_their_tasks(self) -> None:
        """Keep account IDs, passwords, assignments, and unrelated users."""
        group = Group.objects.create(name=SEED_GROUP)
        user = User.objects.create_user(username='demo.ana', password='custom-password')
        user.groups.add(group)
        unrelated = User.objects.create_user(username='demo.bruno')
        task = Task.objects.create(title='Keep this edit', created_by=user, assigned_to=user)

        call_command('seed_demo', stdout=StringIO())

        user.refresh_from_db()
        unrelated.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(user.username, 'ana')
        self.assertEqual(user.get_full_name(), 'Ana Silva')
        self.assertTrue(user.check_password('custom-password'))
        self.assertEqual(unrelated.username, 'demo.bruno')
        self.assertEqual(task.created_by, user)
        self.assertEqual(task.assigned_to, user)
        self.assertEqual(task.title, 'Keep this edit')
        self.assertEqual(Task.objects.count(), 1)
        self.assertEqual(User.objects.count(), 2)

    def test_rolls_back_all_renames_when_a_username_is_taken(self) -> None:
        """Leave both existing and seeded accounts unchanged after a collision."""
        group = Group.objects.create(name=SEED_GROUP)
        for username in ('demo.ana', 'demo.bruno'):
            user = User.objects.create_user(username=username)
            user.groups.add(group)
        User.objects.create_user(username='bruno', first_name='Existing')

        with self.assertRaisesMessage(CommandError, 'username bruno already exists'):
            call_command('seed_demo', stdout=StringIO())

        self.assertSetEqual(
            set(User.objects.values_list('username', flat=True)),
            {'demo.ana', 'demo.bruno', 'bruno'},
        )
        self.assertEqual(User.objects.get(username='bruno').first_name, 'Existing')

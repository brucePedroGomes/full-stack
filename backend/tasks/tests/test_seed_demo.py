from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from tasks.management.commands.seed_demo import DEMO_PASSWORD, TEAM
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

        users = User.objects.exclude(pk=owner.pk)
        tasks = Task.objects.exclude(pk=original.pk)
        self.assertEqual(users.count(), 15)
        self.assertEqual(tasks.count(), 2000)
        self.assertFalse(users.filter(is_staff=True).exists())
        self.assertFalse(users.filter(is_superuser=True).exists())
        demo = users.get(username='bruce-gomes')
        self.assertTrue(demo.check_password(DEMO_PASSWORD))
        self.assertEqual(demo.get_full_name(), 'Bruce Gomes')
        self.assertSetEqual(set(tasks.values_list('status', flat=True)), set(Task.Status.values))
        self.assertTrue(tasks.filter(assigned_to__isnull=True).exists())
        self.assertTrue(tasks.filter(due_date__isnull=True).exists())
        self.assertTrue(tasks.filter(due_date__lt=timezone.localdate()).exists())
        self.assertTrue(tasks.filter(due_date__gt=timezone.localdate()).exists())
        self.assertSetEqual(
            set(users.values_list('username', 'first_name', 'last_name')),
            set(TEAM),
        )
        for user in users:
            self.assertTrue(tasks.filter(assigned_to=user).exists())
        original.refresh_from_db()
        self.assertEqual(original.title, 'Keep this task')

    def test_prints_the_demo_login(self) -> None:
        """Tell the developer which account to use after seeding."""
        out = StringIO()

        call_command('seed_demo', tasks=1, stdout=out)

        self.assertIn(f'Sign in as bruce-gomes with password {DEMO_PASSWORD}', out.getvalue())

    def test_second_run_preserves_edits_and_does_not_duplicate_data(self) -> None:
        """Leave edited demo records untouched on the next run."""
        call_command('seed_demo', tasks=10, stdout=StringIO())
        task = Task.objects.earliest('id')
        task.title = 'An edited demo task'
        task.save()
        user = User.objects.get(username='bruce-gomes')
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
        self.assertFalse(User.objects.exists())

    def test_rejects_invalid_counts(self) -> None:
        """Reject invalid input without creating any data."""
        for count in (0, -1):
            with self.assertRaisesMessage(CommandError, 'positive integer'):
                call_command('seed_demo', tasks=count, stdout=StringIO())
        self.assertFalse(User.objects.exists())

    def test_skips_when_a_demo_username_exists(self) -> None:
        """Keep the existing account and create nothing when a demo username is taken."""
        User.objects.create_user(username='bruce-gomes', password='keep-this-password')
        out = StringIO()

        call_command('seed_demo', stdout=out)

        self.assertIn('Demo users already exist', out.getvalue())
        self.assertEqual(User.objects.count(), 1)
        self.assertTrue(User.objects.get().check_password('keep-this-password'))
        self.assertFalse(Task.objects.exists())

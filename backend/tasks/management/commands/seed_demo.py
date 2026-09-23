from datetime import timedelta
from random import Random

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction
from django.utils import timezone

from tasks.models import Task

TEAM = (
    ('ana', 'Silva'), ('bruno', 'Costa'), ('carla', 'Santos'),
    ('daniel', 'Lima'), ('elisa', 'Rocha'), ('felipe', 'Alves'),
    ('gabriela', 'Mendes'), ('henrique', 'Dias'), ('isabela', 'Ribeiro'),
    ('joao', 'Pereira'), ('luiza', 'Barbosa'), ('marcos', 'Martins'),
    ('natalia', 'Souza'), ('pedro', 'Oliveira'), ('renata', 'Fernandes'),
)
PROJECTS = (
    'customer portal', 'mobile app', 'billing service', 'team dashboard',
    'help center', 'onboarding flow', 'reporting API', 'notification service',
)
WORK = (
    ('Fix keyboard navigation', 'Check focus order and test every action without a mouse.'),
    ('Review the empty states', 'Explain what happened and provide a useful next step.'),
    ('Test the password reset flow', 'Cover expired links, invalid input, and a successful reset.'),
    ('Improve loading feedback', 'Keep the current content visible while fetching updates.'),
    ('Check mobile spacing', 'Review the layout on small phones and tablets.'),
    ('Document the API responses', 'Add request examples and explain validation errors.'),
    ('Reduce slow database queries', 'Measure the slow route and verify the query plan.'),
    ('Review release notes', 'Summarize the changes and include the support team feedback.'),
    ('Add missing form validation', 'Check required fields and show clear error messages.'),
    ('Investigate a failed background job', 'Check the logs and reproduce the failure locally.'),
    ('Prepare the next usability session', 'Write the main scenarios and list the open questions.'),
    ('Update the integration tests', 'Cover successful requests and expected failure responses.'),
)
DEMO_PASSWORD = 'Tempo-demo-2026!'
SEED_GROUP = 'tempo-demo-seed'


class Command(BaseCommand):
    help = 'Create 15 demo users and 2,000 varied tasks once, in development only.'

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument('--tasks', type=int, default=2000)

    @transaction.atomic
    def handle(self, *args: object, **options: object) -> None:
        if not settings.DEBUG:
            raise CommandError('Demo data requires DEBUG=True.')
        count = options['tasks']
        if not isinstance(count, int) or count < 1:
            raise CommandError('--tasks must be a positive integer.')
        group, created = Group.objects.get_or_create(name=SEED_GROUP)
        if not created:
            renamed = self.rename_users(group)
            self.stdout.write(f'Renamed {renamed} seed users. Existing tasks were kept.')
            return
        usernames = [first for first, _last in TEAM]
        if User.objects.filter(username__in=usernames).exists():
            raise CommandError('A seed username already exists. No data was changed.')

        users = [
            User.objects.create_user(
                username=first, email=f'{first}@demo.example',
                first_name=first.capitalize(), last_name=last,
                password=DEMO_PASSWORD,
            )
            for first, last in TEAM
        ]
        for user in users:
            user.groups.add(group)
        random = Random(42)
        today = timezone.localdate()
        tasks: list[Task] = []
        for index in range(count):
            title, description = random.choice(WORK)
            project = random.choice(PROJECTS)
            tasks.append(Task(
                title=f'{title} for the {project} · {index + 1:04d}',
                description=f'{description}\n\nProject: {project.capitalize()}.',
                status=random.choices(Task.Status.values, weights=[20, 25, 25, 10, 20])[0],
                created_by=random.choice(users),
                assigned_to=random.choice([*users, None, None]),
                due_date=(today + timedelta(days=random.randint(-21, 60)))
                if random.random() < 0.8 else None,
            ))
        Task.objects.bulk_create(tasks, batch_size=500)
        self.stdout.write(self.style.SUCCESS(
            f'Created {len(users)} demo users and {len(tasks)} tasks. '
            f'Sign in as ana with password {DEMO_PASSWORD}'
        ))

    def rename_users(self, group: Group) -> int:
        """Upgrade old seed usernames without recreating accounts or tasks."""
        renamed = 0
        for first, last in TEAM:
            user = User.objects.filter(groups=group, username=f'demo.{first}').first()
            if user is None:
                continue
            if User.objects.filter(username=first).exists():
                raise CommandError(f'The username {first} already exists. No data was changed.')
            user.username = first
            user.first_name = user.first_name or first.capitalize()
            user.last_name = user.last_name or last
            user.save(update_fields=['username', 'first_name', 'last_name'])
            renamed += 1
        return renamed

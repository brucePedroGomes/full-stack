from datetime import timedelta
from random import Random

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction
from django.utils import timezone

from tasks.models import Task

# (username, first name, last name)
TEAM = (
    ('bruce-gomes', 'Bruce', 'Gomes'),
    ('bruno', 'Bruno', 'Costa'),
    ('carla', 'Carla', 'Santos'),
    ('daniel', 'Daniel', 'Lima'),
    ('elisa', 'Elisa', 'Rocha'),
    ('felipe', 'Felipe', 'Alves'),
    ('gabriela', 'Gabriela', 'Mendes'),
    ('henrique', 'Henrique', 'Dias'),
    ('isabela', 'Isabela', 'Ribeiro'),
    ('joao', 'Joao', 'Pereira'),
    ('luiza', 'Luiza', 'Barbosa'),
    ('marcos', 'Marcos', 'Martins'),
    ('natalia', 'Natalia', 'Souza'),
    ('pedro', 'Pedro', 'Oliveira'),
    ('renata', 'Renata', 'Fernandes'),
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
        usernames = [username for username, _first, _last in TEAM]
        if User.objects.filter(username__in=usernames).exists():
            self.stdout.write('Demo users already exist. No data was changed.')
            return

        users = [
            User.objects.create_user(
                username=username, email=f'{username}@demo.example',
                first_name=first, last_name=last,
                password=DEMO_PASSWORD,
            )
            for username, first, last in TEAM
        ]
        random = Random(42)
        today = timezone.localdate()
        tasks: list[Task] = []
        for index in range(count):
            title, description = random.choice(WORK)
            tasks.append(Task(
                title=f'{title} · {index + 1:04d}',
                description=description,
                status=random.choices(Task.Status.values, weights=[20, 25, 25, 10, 20])[0],
                created_by=random.choice(users),
                assigned_to=random.choice([*users, None, None]),
                due_date=(today + timedelta(days=random.randint(-21, 60)))
                if random.random() < 0.8 else None,
            ))
        Task.objects.bulk_create(tasks, batch_size=500)
        self.stdout.write(self.style.SUCCESS(
            f'Created {len(users)} demo users and {len(tasks)} tasks. '
            f'Sign in as bruce-gomes with password {DEMO_PASSWORD}'
        ))

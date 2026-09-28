from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.operations import AddIndexConcurrently
from django.contrib.postgres.search import SearchVector
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('tasks', '0003_alter_task_created_by'),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='task',
            index=GinIndex(
                SearchVector('title', 'description', config='english'),
                name='task_search_idx',
            ),
        ),
    ]

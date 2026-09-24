from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('tasks', '0001_initial'),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='task',
            index=models.Index(
                fields=['status', '-updated_at', '-id'],
                name='task_status_updated_id_idx',
            ),
        ),
    ]

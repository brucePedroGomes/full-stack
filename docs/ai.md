# How I use AI

I use Claude Code and Codex for research and support with many kinds of tasks.
I mostly use AI for small and medium-sized tasks. I try to use the official
documentation for what I want to build.

I explain clearly what I want the AI to do. Then I review its suggestions using
my experience as a programmer. I check whether the code follows the
documentation, handles errors, and fits the project.

I work one step at a time. I usually do not ask for a complete solution at once
because AI can make mistakes or invent details. I build the solution in small
parts, check each part, and only then move to the next step.

I do not trust AI blindly. I always check the results: I read the code, run the
tests, and check the final result myself. I also check authentication,
validation, database queries, and code readability.

## Example prompt

"Fix only the status update method in `TaskStatusSerializer`. An old task instance
must not overwrite newer changes to other fields or recreate a deleted task.
Reload and lock the task inside a database transaction before saving the new
status. Return 404 if the task no longer exists. Add tests for both cases, and
explain the change so I can review it before we continue."

## Small example from the reviewed code

The status update in [`TaskStatusSerializer`](../backend/tasks/serializers.py)
reloads and locks the task inside a database transaction before saving the new status:

```python
@transaction.atomic
def update(self, instance: Task, validated_data: dict[str, Any]) -> Task:
    """Do not overwrite newer fields or recreate a concurrently deleted row."""
    instance = get_object_or_404(Task.objects.select_for_update(), pk=instance.pk)
    return super().update(instance, validated_data)
```

This helps keep newer changes to other fields when an older task instance is used.
The [task update tests](../backend/tasks/tests/test_task_concurrent_updates.py)
cover this case and updates to a task that has been deleted.

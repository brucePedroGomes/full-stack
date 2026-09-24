import { taskStatuses, type Task } from '@/api/tasks'
import { getUserName } from '@/api/users'
import { useTaskContext } from '@/contexts/TaskContext'
import { Button, Icon, Select } from './ui'

type TaskCardProps = {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  const { status, editTask } = useTaskContext()

  return (
    <li className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 py-2 font-semibold wrap-anywhere">
          {task.title}
        </h3>
        <Button
          type="button"
          variant="icon"
          aria-label={`Edit ${task.title}`}
          onClick={() => editTask(task)}
          disabled={status.isPending}
        >
          <Icon name="edit" />
        </Button>
      </div>
      {task.description ? (
        <p className="line-clamp-3 text-sm text-gray-600 wrap-anywhere">
          {task.description}
        </p>
      ) : null}
      <p className="text-sm text-gray-600 wrap-anywhere">
        {task.assignee ? getUserName(task.assignee) : 'Unassigned'} ·{' '}
        {task.due_date ? (
          <>
            Due <time dateTime={task.due_date}>{task.due_date}</time>
          </>
        ) : (
          'No due date'
        )}
      </p>
      <Select
        aria-label={`Status for ${task.title}`}
        value={task.status}
        disabled={status.isPending}
        onChange={(value) => status.mutate({ id: task.id, value })}
        options={taskStatuses}
        className="text-sm"
      />
    </li>
  )
}

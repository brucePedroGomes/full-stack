import { taskStatuses, type Task } from '@/api/tasks'
import { getUserName } from '@/api/users'
import { TASK_DRAG_TYPE } from '@/config'
import { useTaskContext } from '@/contexts/TaskContext'
import { Button, Icon, Select } from './ui'

type TaskCardProps = {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  const { moveTask, editTask, movingTaskIds } = useTaskContext()
  const moving = movingTaskIds.includes(task.id)

  return (
    <li
      draggable={!moving}
      onDragStart={(event) =>
        event.dataTransfer.setData(TASK_DRAG_TYPE, JSON.stringify(task))
      }
      className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 py-2 font-semibold wrap-anywhere">
          {task.title}
        </h3>
        <Button
          type="button"
          variant="icon"
          aria-label={`Edit ${task.title}`}
          onClick={() => editTask(task)}
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
        {task.is_overdue ? <strong className="text-red-700"> · Overdue</strong> : null}
      </p>
      <Select
        aria-label={`Status for ${task.title}`}
        value={task.status}
        disabled={moving}
        onChange={(value) => moveTask(task, value)}
        options={taskStatuses}
        className="text-sm"
      />
      {moving ? <p className="text-sm text-gray-600">Moving...</p> : null}
    </li>
  )
}

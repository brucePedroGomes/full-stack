import { memo } from 'react'
import { taskStatuses, type Task, type TaskStatus } from '@/api/tasks'
import { getUserName } from '@/api/users'
import { TASK_DRAG_TYPE } from '@/config'
import { Button, Icon, Select } from './ui'

const dueDateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

type TaskCardProps = {
  task: Task
  moving: boolean
  onMove: (task: Task, to: TaskStatus) => void
  onEdit: (task: Task) => void
}

export const TaskCard = memo(function TaskCard({
  task,
  moving,
  onMove,
  onEdit,
}: TaskCardProps) {
  return (
    <li
      draggable={!moving}
      onDragStart={(event) =>
        event.dataTransfer.setData(TASK_DRAG_TYPE, JSON.stringify(task))
      }
      className="min-w-0 cursor-grab space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-gray-300 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 py-2 font-semibold wrap-anywhere">
          {task.title}
        </h3>
        <Button
          type="button"
          variant="icon"
          aria-label={`Edit ${task.title}`}
          onClick={() => onEdit(task)}
        >
          <Icon name="edit" />
        </Button>
      </div>
      {task.description ? (
        <p className="line-clamp-3 text-sm text-gray-600 wrap-anywhere">
          {task.description}
        </p>
      ) : null}
      <div className="space-y-1 text-sm text-gray-600 wrap-anywhere">
        <p className={task.is_overdue ? 'font-semibold text-red-700' : ''}>
          {task.due_date ? (
            <>
              {task.is_overdue ? 'Overdue · ' : 'Due '}
              <time dateTime={task.due_date}>
                {dueDateFormat.format(new Date(task.due_date))}
              </time>
            </>
          ) : (
            'No due date'
          )}
        </p>
        <p>{task.assignee ? getUserName(task.assignee) : 'Unassigned'}</p>
      </div>
      <Select
        aria-label={`Status for ${task.title}`}
        value={task.status}
        disabled={moving}
        onChange={(value) => onMove(task, value)}
        options={taskStatuses}
        className="text-sm"
      />
      {moving ? <p className="text-sm text-gray-600">Moving...</p> : null}
    </li>
  )
})

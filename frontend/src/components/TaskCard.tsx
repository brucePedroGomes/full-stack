import { useCallback, type ChangeEvent } from 'react'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import { taskStatuses, type Task, type TaskStatus } from '@/api/tasks'
import { getUserName } from '@/api/users'

type TaskCardProps = {
  task: Task
  busy: boolean
  onStatusChange: (id: number, status: TaskStatus) => void
  onEdit: (task: Task) => void
}

export function TaskCard({ task, busy, onStatusChange, onEdit }: TaskCardProps) {
  const handleStatusChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      onStatusChange(task.id, event.currentTarget.value as TaskStatus)
    },
    [onStatusChange, task.id],
  )
  const handleEdit = useCallback(() => onEdit(task), [onEdit, task])

  return (
    <li className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 py-2 font-semibold wrap-anywhere">
          {task.title}
        </h3>
        <button
          type="button"
          aria-label={`Edit ${task.title}`}
          onClick={handleEdit}
          disabled={busy}
          className="flex size-11 shrink-0 items-center justify-center rounded text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          <PencilSquareIcon aria-hidden="true" className="size-5" />
        </button>
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
      <select
        aria-label={`Status for ${task.title}`}
        value={task.status}
        disabled={busy}
        onChange={handleStatusChange}
        className="min-h-11 w-full min-w-0 rounded border border-gray-300 bg-white px-3 text-sm focus:outline-2 focus:outline-blue-600 disabled:opacity-50"
      >
        {taskStatuses.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </li>
  )
}

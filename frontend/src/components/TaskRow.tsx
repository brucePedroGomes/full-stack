import { useCallback, type ChangeEvent } from 'react'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import { taskStatuses, type Task, type TaskStatus } from '@/api/tasks'
import { getUserName } from '@/api/users'

type TaskRowProps = {
  task: Task
  busy: boolean
  onStatusChange: (id: number, status: TaskStatus) => void
  onEdit: (task: Task) => void
}

export function TaskRow({ task, busy, onStatusChange, onEdit }: TaskRowProps) {
  const handleStatusChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      onStatusChange(task.id, event.currentTarget.value as TaskStatus)
    },
    [onStatusChange, task.id],
  )
  const handleEdit = useCallback(() => onEdit(task), [onEdit, task])

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold wrap-anywhere">{task.title}</h2>
        <p className="mt-1 text-sm text-gray-600 wrap-anywhere">
          {task.assignee ? getUserName(task.assignee) : 'Unassigned'} ·{' '}
          {task.due_date ? (
            <>
              Due <time dateTime={task.due_date}>{task.due_date}</time>
            </>
          ) : (
            'No due date'
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label={`Status for ${task.title}`}
          value={task.status}
          disabled={busy}
          onChange={handleStatusChange}
          className="min-h-11 rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600 disabled:opacity-50"
        >
          {taskStatuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          aria-label={`Edit ${task.title}`}
          onClick={handleEdit}
          disabled={busy}
          className="flex min-h-11 items-center gap-2 rounded border border-gray-300 px-3 hover:bg-gray-100 disabled:opacity-50"
        >
          <PencilSquareIcon aria-hidden="true" className="size-5" /> Edit
        </button>
      </div>
    </li>
  )
}

import type { DragEvent } from 'react'
import { getApiErrorMessage } from '@/api/session'
import type { Task, TaskStatus } from '@/api/tasks'
import { TASK_DRAG_TYPE } from '@/config'
import { useTaskContext } from '@/contexts/TaskContext'
import { useColumnTasks } from '@/hooks/useColumnTasks'
import { QuickAdd } from './QuickAdd'
import { TaskCard } from './TaskCard'
import { Button } from './ui'

const statusColors: Record<TaskStatus, { dot: string; column: string }> = {
  planned: { dot: 'bg-gray-500', column: 'border-gray-200 bg-gray-100' },
  to_do: { dot: 'bg-blue-600', column: 'border-blue-200 bg-blue-50' },
  in_progress: { dot: 'bg-amber-500', column: 'border-amber-200 bg-amber-50' },
  blocked: { dot: 'bg-red-600', column: 'border-red-200 bg-red-50' },
  done: { dot: 'bg-emerald-600', column: 'border-emerald-200 bg-emerald-50' },
}

type TaskColumnProps = {
  status: TaskStatus
  label: string
}

export function TaskColumn({ status, label }: TaskColumnProps) {
  const { moveTask, editTask, movingTaskIds } = useTaskContext()
  const column = useColumnTasks(status)

  function dropCard(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const data = event.dataTransfer.getData(TASK_DRAG_TYPE)
    if (!data) return
    const task: Task = JSON.parse(data)
    moveTask(task, status)
  }

  return (
    <section
      aria-labelledby={`column-${status}`}
      aria-busy={column.isUpdating}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropCard}
      className={`flex min-w-64 flex-1 snap-start flex-col rounded-xl border p-3 ${statusColors[status].column} ${column.isShowingOldResults ? 'opacity-60' : ''}`}
    >
      <div className="mb-3 flex items-center gap-2 px-1 py-2">
        <span
          aria-hidden="true"
          className={`size-2.5 shrink-0 rounded-full ${statusColors[status].dot}`}
        />
        <h2 id={`column-${status}`} className="min-w-0 flex-1 text-sm font-semibold">
          {label}
        </h2>
        {column.count === undefined ? null : (
          <span className="rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums">
            {column.count}
            <span className="sr-only"> tasks</span>
          </span>
        )}
      </div>
      <QuickAdd status={status} label={label} />
      {column.isLoading ? (
        <p role="status" className="px-1 text-sm text-gray-600">
          Loading tasks...
        </p>
      ) : null}
      {column.error ? (
        <div role="alert" className="px-1 text-sm text-red-700">
          <p>{getApiErrorMessage(column.error)}</p>
          <Button variant="plain" onClick={column.retry}>
            Retry
          </Button>
        </div>
      ) : null}
      {column.tasks.length ? (
        <ul
          aria-label={`${label} tasks`}
          className="max-h-[65vh] space-y-3 overflow-y-auto p-1 lg:max-h-none lg:min-h-0 lg:flex-1"
        >
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              moving={movingTaskIds.includes(task.id)}
              onMove={moveTask}
              onEdit={editTask}
            />
          ))}
        </ul>
      ) : null}
      {column.isEmpty ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-600">
          No tasks
        </p>
      ) : null}
      {column.hasMore ? (
        <Button
          className="mt-3 w-full"
          disabled={column.isUpdating}
          onClick={column.showMore}
        >
          {column.isLoadingMore ? 'Loading...' : 'Show more'}
        </Button>
      ) : null}
    </section>
  )
}

import { taskStatuses, type Task, type TaskStatus } from '@/api/tasks'
import { TaskCard } from './TaskCard'

const statusColors: Record<TaskStatus, { dot: string; column: string }> = {
  planned: { dot: 'bg-gray-500', column: 'border-gray-200 bg-gray-100' },
  to_do: { dot: 'bg-blue-600', column: 'border-blue-200 bg-blue-50' },
  in_progress: { dot: 'bg-amber-500', column: 'border-amber-200 bg-amber-50' },
  blocked: { dot: 'bg-red-600', column: 'border-red-200 bg-red-50' },
  done: { dot: 'bg-emerald-600', column: 'border-emerald-200 bg-emerald-50' },
}

type TaskBoardProps = {
  tasks: Task[]
  busy: boolean
  onStatusChange: (id: number, status: TaskStatus) => void
  onEdit: (task: Task) => void
}

export function TaskBoard({
  tasks,
  busy,
  onStatusChange,
  onEdit,
}: TaskBoardProps) {
  return (
    <section
      aria-label="Task board"
      aria-busy={busy}
      className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {taskStatuses.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status.value)

        return (
          <section
            key={status.value}
            aria-labelledby={`column-${status.value}`}
            className={`min-w-0 rounded-xl border p-3 ${statusColors[status.value].column}`}
          >
            <div className="mb-3 flex items-center gap-2 px-1 py-2">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${statusColors[status.value].dot}`}
              />
              <h2
                id={`column-${status.value}`}
                className="min-w-0 flex-1 text-sm font-semibold"
              >
                {status.label}
              </h2>
              <span className="rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums">
                {columnTasks.length}
                <span className="sr-only"> tasks on this page</span>
              </span>
            </div>
            {columnTasks.length ? (
              <ul aria-label={`${status.label} tasks`} className="space-y-3">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    busy={busy}
                    onStatusChange={onStatusChange}
                    onEdit={onEdit}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-600">
                No tasks on this page.
              </p>
            )}
          </section>
        )
      })}
    </section>
  )
}

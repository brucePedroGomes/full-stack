import { taskStatuses, type Task, type TaskStatus } from '@/api/tasks'
import { TaskCard } from './TaskCard'

const statusColors: Record<TaskStatus, string> = {
  planned: 'bg-gray-500',
  to_do: 'bg-blue-600',
  in_progress: 'bg-amber-500',
  blocked: 'bg-red-600',
  done: 'bg-emerald-600',
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
            className="min-w-0 rounded-xl border border-gray-200 bg-gray-100 p-3"
          >
            <div className="mb-3 flex items-center gap-2 px-1 py-2">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${statusColors[status.value]}`}
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

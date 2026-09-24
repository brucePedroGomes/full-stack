import { taskStatuses } from '@/api/tasks'
import { TaskColumn } from './TaskColumn'

export function TaskBoard() {
  return (
    <section
      aria-label="Task board"
      className="relative flex snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-4"
    >
      {taskStatuses.map((status) => (
        <TaskColumn key={status.value} status={status.value} label={status.label} />
      ))}
    </section>
  )
}

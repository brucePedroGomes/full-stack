import { getApiErrorMessage } from '@/api/session'
import { useTaskContext } from '@/contexts/TaskContext'
import { TaskBoard } from './TaskBoard'
import { TaskFilters } from './TaskFilters'
import { TaskForm } from './TaskForm'
import { Button, Icon } from './ui'

export function TaskPage() {
  const { move, notice, editor, newTask } = useTaskContext()

  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p role="status" className="text-sm text-gray-700">
          {notice}
        </p>
        <Button variant="primary" onClick={newTask}>
          <Icon name="add" /> New task
        </Button>
      </div>
      <TaskFilters />
      {move.error ? (
        <p role="alert" className="text-red-700">
          {getApiErrorMessage(move.error)}
        </p>
      ) : null}
      <TaskBoard />
      {editor ? <TaskForm task={editor.task} /> : null}
    </main>
  )
}

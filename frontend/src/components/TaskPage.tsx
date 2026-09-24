import { getApiErrorMessage } from '@/api/session'
import { useTaskContext } from '@/contexts/TaskContext'
import { Pagination } from './Pagination'
import { TaskFilters } from './TaskFilters'
import { TaskForm } from './TaskForm'
import { TaskBoard } from './TaskBoard'
import { Button, Icon } from './ui'

export function TaskPage() {
  const { tasks, status, page, setPage, editor, newTask } = useTaskContext()
  const error = tasks.error || status.error

  return (
    <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <Button variant="primary" onClick={newTask}>
          <Icon name="add" /> New task
        </Button>
      </div>
      <TaskFilters />
      {tasks.isPending ? <p role="status">Loading tasks...</p> : null}
      {error ? (
        <div role="alert" className="text-red-700">
          <p>{getApiErrorMessage(error)}</p>
          {tasks.error ? (
            <Button onClick={() => void tasks.refetch()} variant="plain">
              Retry tasks
            </Button>
          ) : null}
        </div>
      ) : null}
      {tasks.data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <p role="status">
              Showing {tasks.data.results.length} of {tasks.data.count} tasks
            </p>
            <p>Columns show tasks on this page.</p>
          </div>
          {tasks.data.results.length === 0 ? (
            <p>No tasks found.</p>
          ) : null}
          <TaskBoard tasks={tasks.data.results} />
        </>
      ) : null}
      <Pagination
        label="Task pages"
        page={page}
        hasNext={Boolean(tasks.data?.next)}
        busy={tasks.isFetching || status.isPending}
        onChange={setPage}
      />
      {editor ? <TaskForm task={editor.task} /> : null}
    </main>
  )
}

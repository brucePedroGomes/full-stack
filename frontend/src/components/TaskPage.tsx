import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApiErrorMessage,
  SessionExpiredError,
  type SignedInSession,
} from '@/api/session'
import {
  defaultFilters,
  tasksQuery,
  updateTaskStatus,
  type Task,
  type TaskFilters as Filters,
  type TaskStatus,
} from '@/api/tasks'
import { Pagination } from './Pagination'
import { TaskFilters } from './TaskFilters'
import { TaskForm } from './TaskForm'
import { TaskBoard } from './TaskBoard'
import { Button, Icon } from './ui'

type TaskPageProps = SignedInSession & {
  onSessionExpired: (message: string) => void
}

export function TaskPage({
  session,
  account,
  onSessionExpired,
}: TaskPageProps) {
  const client = useQueryClient()
  const [filters, setFilters] = useState(defaultFilters)
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null)
  const tasks = useQuery(tasksQuery(session, account.id, filters, page))
  const status = useMutation({
    mutationFn: ({ id, value }: { id: number; value: TaskStatus }) =>
      updateTaskStatus(session, id, value),
    onSuccess: async () => {
      if (filters.status !== 'all') setPage(1)
      await client.invalidateQueries({ queryKey: ['tasks', account.id] })
    },
  })
  const error = tasks.error || status.error
  const { mutate: changeStatus, reset: resetStatus } = status
  const { refetch } = tasks

  useEffect(() => {
    if (error instanceof SessionExpiredError) onSessionExpired(error.message)
  }, [error, onSessionExpired])

  const handleSaved = useCallback(async () => {
    setEditor(null)
    setPage(1)
    await client.invalidateQueries({ queryKey: ['tasks', account.id] })
  }, [client, account.id])
  const handleNewTask = useCallback(() => setEditor({ task: null }), [])
  const handleEditTask = useCallback((task: Task) => setEditor({ task }), [])
  const handleCloseEditor = useCallback(() => setEditor(null), [])
  const handleApplyFilters = useCallback(
    (value: Filters) => {
      setFilters(value)
      setPage(1)
      resetStatus()
    },
    [resetStatus],
  )
  const handleRetry = useCallback(() => {
    void refetch()
  }, [refetch])
  const handleStatusChange = useCallback(
    (id: number, value: TaskStatus) => {
      changeStatus({ id, value })
    },
    [changeStatus],
  )

  return (
    <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <Button
          variant="primary"
          onClick={handleNewTask}
        >
          <Icon name="add" /> New task
        </Button>
      </div>
      <TaskFilters
        session={session}
        filters={filters}
        onApply={handleApplyFilters}
        onSessionExpired={onSessionExpired}
      />
      {tasks.isPending ? <p role="status">Loading tasks...</p> : null}
      {error ? (
        <div role="alert" className="text-red-700">
          <p>{getApiErrorMessage(error)}</p>
          {tasks.error ? (
            <Button onClick={handleRetry} variant="plain">
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
          <TaskBoard
            tasks={tasks.data.results}
            busy={status.isPending}
            onStatusChange={handleStatusChange}
            onEdit={handleEditTask}
          />
        </>
      ) : null}
      <Pagination
        label="Task pages"
        page={page}
        hasNext={Boolean(tasks.data?.next)}
        busy={tasks.isFetching || status.isPending}
        onChange={setPage}
      />
      {editor ? (
        <TaskForm
          task={editor.task}
          session={session}
          onClose={handleCloseEditor}
          onSaved={handleSaved}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </main>
  )
}

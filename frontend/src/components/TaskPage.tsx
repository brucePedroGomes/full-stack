import { useEffect, useState } from 'react'
import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApiErrorMessage,
  SessionExpiredError,
  type SignedInSession,
} from '@/api/session'
import {
  defaultFilters,
  tasksQuery,
  taskStatuses,
  updateTaskStatus,
  type Task,
  type TaskStatus,
} from '@/api/tasks'
import { getUserName } from '@/api/users'
import { Pagination } from './Pagination'
import { TaskFilters } from './TaskFilters'
import { TaskForm } from './TaskForm'

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

  useEffect(() => {
    if (error instanceof SessionExpiredError) onSessionExpired(error.message)
  }, [error, onSessionExpired])

  async function saved() {
    setEditor(null)
    setPage(1)
    await client.invalidateQueries({ queryKey: ['tasks', account.id] })
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <button
          onClick={() => setEditor({ task: null })}
          className="flex min-h-11 items-center gap-2 rounded bg-blue-700 px-4 text-white hover:bg-blue-800"
        >
          <PlusIcon aria-hidden="true" className="size-5" /> New task
        </button>
      </div>
      <TaskFilters
        session={session}
        onApply={(value) => {
          setFilters(value)
          setPage(1)
          status.reset()
        }}
        onSessionExpired={onSessionExpired}
      />
      {tasks.isPending ? <p role="status">Loading tasks...</p> : null}
      {error ? (
        <div role="alert" className="text-red-700">
          <p>{getApiErrorMessage(error)}</p>
          {tasks.error ? (
            <button
              onClick={() => void tasks.refetch()}
              className="min-h-11 underline"
            >
              Retry tasks
            </button>
          ) : null}
        </div>
      ) : null}
      {tasks.data ? (
        <>
          <p className="text-sm text-gray-600">Tasks: {tasks.data.count}</p>
          {tasks.data.results.length === 0 ? (
            <p>No tasks found.</p>
          ) : (
            <ul
              aria-label="Tasks"
              className="divide-y divide-gray-200 rounded border border-gray-200 bg-white"
            >
              {tasks.data.results.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold wrap-anywhere">
                      {task.title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 wrap-anywhere">
                      {task.assignee
                        ? getUserName(task.assignee)
                        : 'Unassigned'}{' '}
                      ·{' '}
                      {task.due_date ? (
                        <>
                          Due{' '}
                          <time dateTime={task.due_date}>{task.due_date}</time>
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
                      disabled={status.isPending}
                      onChange={(event) =>
                        status.mutate({
                          id: task.id,
                          value: event.target.value as TaskStatus,
                        })
                      }
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
                      onClick={() => setEditor({ task })}
                      disabled={status.isPending}
                      className="flex min-h-11 items-center gap-2 rounded border border-gray-300 px-3 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <PencilSquareIcon aria-hidden="true" className="size-5" />{' '}
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
          onClose={() => setEditor(null)}
          onSaved={saved}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </main>
  )
}

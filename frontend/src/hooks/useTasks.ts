import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SessionExpiredError, type SignedInSession } from '@/api/session'
import {
  createTask,
  defaultFilters,
  deleteTask,
  tasksQuery,
  updateTask,
  updateTaskStatus,
  type Task,
  type TaskFilters,
  type TaskInput,
  type TaskStatus,
} from '@/api/tasks'
import { usersQuery } from '@/api/users'

type UseTasksOptions = SignedInSession & {
  onSessionExpired: (message: string) => void
}

export function useTasks({ session, account, onSessionExpired }: UseTasksOptions) {
  const client = useQueryClient()
  const [filters, setFilters] = useState(defaultFilters)
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null)
  const tasks = useQuery(tasksQuery(session, account.id, filters, page))
  const users = useQuery(usersQuery(session))

  function refreshTasks() {
    return client.invalidateQueries({ queryKey: ['tasks', account.id] })
  }

  async function finishEditing() {
    setEditor(null)
    setPage(1)
    await refreshTasks()
  }

  const status = useMutation({
    mutationFn: ({ id, value }: { id: number; value: TaskStatus }) =>
      updateTaskStatus(session, id, value),
    onSuccess: async () => {
      if (filters.status !== 'all') setPage(1)
      await refreshTasks()
    },
  })
  const save = useMutation({
    mutationFn: (values: TaskInput) => {
      const task = editor?.task
      return task
        ? updateTask(session, task.id, values)
        : createTask(session, values)
    },
    onSuccess: finishEditing,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteTask(session, id),
    onSuccess: finishEditing,
  })

  function editTask(task: Task | null) {
    save.reset()
    remove.reset()
    setEditor({ task })
  }

  function newTask() {
    editTask(null)
  }

  function closeEditor() {
    setEditor(null)
  }

  const { reset: resetStatus } = status
  const updateFilters = useCallback(
    (changes: Partial<TaskFilters>) => {
      setFilters((current) => ({ ...current, ...changes }))
      setPage(1)
      resetStatus()
    },
    [resetStatus],
  )

  function resetFilters() {
    updateFilters(defaultFilters)
  }

  const sessionError = [
    tasks.error,
    status.error,
    save.error,
    remove.error,
    users.error,
  ].find((error) => error instanceof SessionExpiredError)

  useEffect(() => {
    if (sessionError) onSessionExpired(sessionError.message)
  }, [sessionError, onSessionExpired])

  return {
    filters,
    updateFilters,
    resetFilters,
    page,
    setPage,
    tasks,
    status,
    users,
    editor,
    newTask,
    editTask,
    closeEditor,
    save,
    remove,
  }
}

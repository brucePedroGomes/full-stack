import { useCallback, useEffect, useState } from 'react'
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { SessionExpiredError, type SignedInSession } from '@/api/session'
import {
  columnQuery,
  createTask,
  defaultFilters,
  deleteTask,
  statusLabel,
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

type Move = { task: Task; to: TaskStatus }

export function useTasks({ session, account, onSessionExpired }: UseTasksOptions) {
  const client = useQueryClient()
  const [filters, setFilters] = useState(defaultFilters)
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null)
  const [notice, setNotice] = useState('')
  const users = useQuery(usersQuery(session))

  function columnTasks(status: TaskStatus) {
    return columnQuery(session, account.id, filters, status)
  }

  function refreshColumns(...statuses: TaskStatus[]) {
    return Promise.all(
      statuses.map((status) =>
        client.invalidateQueries({ queryKey: ['tasks', account.id, status] }),
      ),
    )
  }

  async function finishEditing() {
    const status = editor?.task?.status ?? 'planned'
    setEditor(null)
    await refreshColumns(status)
  }

  const move = useMutation({
    mutationKey: ['move'],
    mutationFn: ({ task, to }: Move) => updateTaskStatus(session, task.id, to),
    onSuccess: (_result, { task, to }) =>
      setNotice(`Moved "${task.title}" to ${statusLabel(to)}.`),
    onSettled: (_result, _error, { task, to }) => refreshColumns(task.status, to),
  })
  const movingTaskIds = useMutationState({
    filters: { mutationKey: ['move'], status: 'pending' },
    select: (mutation) => (mutation.state.variables as Move).task.id,
  })

  function moveTask(task: Task, to: TaskStatus) {
    if (task.status !== to && !movingTaskIds.includes(task.id)) move.mutate({ task, to })
  }

  const quickAdd = useMutation({
    mutationFn: ({ title, status }: { title: string; status: TaskStatus }) =>
      createTask(session, {
        title,
        description: '',
        due_date: null,
        assigned_to: null,
        status,
      }),
    onSuccess: (task) => setNotice(`Added "${task.title}".`),
    onSettled: (_result, _error, { status }) => refreshColumns(status),
  })

  const save = useMutation({
    mutationFn: (values: TaskInput) => {
      const task = editor?.task
      return task
        ? updateTask(session, task.id, values)
        : createTask(session, values)
    },
    onSuccess: (task) => {
      setNotice(`Saved "${task.title}".`)
      return finishEditing()
    },
  })
  const remove = useMutation({
    mutationFn: (task: Task) => deleteTask(session, task.id),
    onSuccess: (_result, task) => {
      setNotice(`Deleted "${task.title}".`)
      return finishEditing()
    },
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

  const { reset: resetMove } = move
  const updateFilters = useCallback(
    (changes: Partial<TaskFilters>) => {
      setFilters((current) => ({ ...current, ...changes }))
      resetMove()
    },
    [resetMove],
  )

  function resetFilters() {
    updateFilters(defaultFilters)
  }

  const sessionError = [
    move.error,
    quickAdd.error,
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
    columnTasks,
    move,
    moveTask,
    movingTaskIds,
    notice,
    quickAdd,
    users,
    editor,
    newTask,
    editTask,
    closeEditor,
    save,
    remove,
    onSessionExpired,
  }
}

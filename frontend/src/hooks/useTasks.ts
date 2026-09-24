import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@/api/session'
import {
  createTask,
  deleteTask,
  tasksQuery,
  updateTask,
  updateTaskStatus,
  type Task,
  type TaskFilters,
  type TaskInput,
  type TaskStatus,
} from '@/api/tasks'

export function useTasks(
  session: Session,
  accountId: number,
  filters: TaskFilters,
  page: number,
  onStatusChanged: () => void,
) {
  const client = useQueryClient()
  const tasks = useQuery(tasksQuery(session, accountId, filters, page))
  const refresh = useCallback(
    () => client.invalidateQueries({ queryKey: ['tasks', accountId] }),
    [client, accountId],
  )
  const status = useMutation({
    mutationFn: ({ id, value }: { id: number; value: TaskStatus }) =>
      updateTaskStatus(session, id, value),
    onSuccess: async () => {
      onStatusChanged()
      await refresh()
    },
  })

  return { tasks, status, refresh }
}

export function useTaskMutations(
  session: Session,
  task: Task | null,
  onSaved: () => Promise<void>,
) {
  const save = useMutation({
    mutationFn: (values: TaskInput) =>
      task ? updateTask(session, task.id, values) : createTask(session, values),
    onSuccess: onSaved,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteTask(session, id),
    onSuccess: onSaved,
  })

  return { save, remove }
}

import { queryOptions } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/config'
import { requestWithSession, type Session } from './session'
import type { UserSummary } from './users'

export const taskStatuses = [
  { value: 'planned', label: 'Planned' },
  { value: 'to_do', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
] as const

export type TaskStatus = (typeof taskStatuses)[number]['value']
export type Task = {
  id: number
  title: string
  description: string
  status: TaskStatus
  due_date: string | null
  assigned_to: number | null
  assignee: UserSummary | null
}
export type TaskInput = Pick<
  Task,
  'title' | 'description' | 'due_date' | 'assigned_to'
>
export type TaskPage = { count: number; next: string | null; results: Task[] }
export type TaskFilters = {
  search: string
  status: TaskStatus | 'all'
  assignee: 'all' | 'unassigned' | number
  due_date: string
}
export const defaultFilters: TaskFilters = {
  search: '',
  status: 'all',
  assignee: 'all',
  due_date: '',
}

export function tasksQuery(
  session: Session,
  accountId: number,
  filters: TaskFilters,
  page: number,
) {
  return queryOptions({
    queryKey: ['tasks', accountId, filters, page],
    queryFn: ({ signal }) => getTasks(session, filters, page, signal),
    staleTime: 30_000,
    retry: false,
  })
}

export async function getTasks(
  session: Session,
  filters: TaskFilters,
  page = 1,
  signal?: AbortSignal,
): Promise<TaskPage> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
    ordering: '-id',
  })
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.due_date) params.set('due_date', filters.due_date)
  if (typeof filters.assignee === 'number')
    params.set('assigned_to', String(filters.assignee))
  if (filters.assignee === 'unassigned') params.set('unassigned', 'true')
  const response = await requestWithSession(`/api/tasks/?${params}`, session, {
    signal,
  })
  return response.json() as Promise<TaskPage>
}

export async function createTask(
  session: Session,
  values: TaskInput,
): Promise<Task> {
  const response = await requestWithSession('/api/tasks/', session, {
    method: 'post',
    json: values,
  })
  return response.json() as Promise<Task>
}

export async function updateTask(
  session: Session,
  id: number,
  values: TaskInput,
): Promise<Task> {
  const response = await requestWithSession(`/api/tasks/${id}/`, session, {
    method: 'patch',
    json: values,
  })
  return response.json() as Promise<Task>
}

export async function deleteTask(session: Session, id: number): Promise<void> {
  await requestWithSession(`/api/tasks/${id}/`, session, { method: 'delete' })
}

export async function updateTaskStatus(
  session: Session,
  id: number,
  status: TaskStatus,
): Promise<TaskStatus> {
  const response = await requestWithSession(
    `/api/tasks/${id}/status/`,
    session,
    { method: 'patch', json: { status } },
  )
  const data = (await response.json()) as { status: TaskStatus }
  return data.status
}

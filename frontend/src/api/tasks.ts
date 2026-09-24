import { infiniteQueryOptions, keepPreviousData } from '@tanstack/react-query'
import { z } from 'zod'
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

export function statusLabel(status: TaskStatus): string {
  return taskStatuses.find((item) => item.value === status)?.label ?? status
}

export const taskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter a task title.')
    .max(200, 'Use 200 characters or fewer for the title.'),
  description: z.string().trim(),
  due_date: z.preprocess(
    (value) => (value === '' ? null : value),
    z.iso.date({ error: 'Enter a valid due date.' }).nullable(),
  ),
  assigned_to: z.number().int().positive().nullable(),
})
export type TaskInput = z.infer<typeof taskInputSchema>
export type Task = TaskInput & {
  id: number
  status: TaskStatus
  assignee: UserSummary | null
  is_overdue: boolean
}
export type TaskPage = { count: number; next: string | null; results: Task[] }
export type DueFilter = 'all' | 'overdue' | 'next7'
export type TaskFilters = {
  search: string
  assignee: 'all' | 'unassigned' | number
  due: DueFilter
}
export const defaultFilters: TaskFilters = {
  search: '',
  assignee: 'all',
  due: 'all',
}

export function columnQuery(
  session: Session,
  accountId: number,
  filters: TaskFilters,
  status: TaskStatus,
) {
  return infiniteQueryOptions({
    queryKey: ['tasks', accountId, status, filters],
    queryFn: ({ pageParam, signal }) =>
      getTasks(session, filters, status, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.next ? allPages.length + 1 : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })
}

export async function getTasks(
  session: Session,
  filters: TaskFilters,
  status: TaskStatus,
  page = 1,
  signal?: AbortSignal,
): Promise<TaskPage> {
  const params = new URLSearchParams({ page: String(page), status })
  if (filters.search) params.set('search', filters.search)
  if (filters.due !== 'all') params.set('due', filters.due)
  if (typeof filters.assignee === 'number')
    params.set('assigned_to', String(filters.assignee))
  if (filters.assignee === 'unassigned') params.set('unassigned', 'true')
  return requestWithSession<TaskPage>(`/api/tasks/?${params}`, session, {
    signal,
  })
}

export async function createTask(
  session: Session,
  values: TaskInput & { status?: TaskStatus },
): Promise<Task> {
  return requestWithSession<Task>('/api/tasks/', session, {
    method: 'post',
    data: values,
  })
}

export async function updateTask(
  session: Session,
  id: number,
  values: TaskInput,
): Promise<Task> {
  return requestWithSession<Task>(`/api/tasks/${id}/`, session, {
    method: 'patch',
    data: values,
  })
}

export async function deleteTask(session: Session, id: number): Promise<void> {
  await requestWithSession(`/api/tasks/${id}/`, session, { method: 'delete' })
}

export async function updateTaskStatus(
  session: Session,
  id: number,
  status: TaskStatus,
): Promise<TaskStatus> {
  const data = await requestWithSession<{ status: TaskStatus }>(
    `/api/tasks/${id}/status/`,
    session,
    { method: 'patch', data: { status } },
  )
  return data.status
}

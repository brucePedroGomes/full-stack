import { expect, test, vi } from 'vitest'
import { requestWithSession } from '@/api/session'
import {
  deleteTask,
  getTasks,
  taskInputSchema,
  updateTaskStatus,
} from '@/api/tasks'
import { makeTask } from '../support/fixtures'

vi.mock('@/api/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/session')>()),
  requestWithSession: vi.fn(),
}))

test('validates calendar dates and preserves an empty deadline', () => {
  /** Keeps date-only values without timezone conversion. */
  const values = { title: 'Report', description: '', assigned_to: null }
  expect(
    taskInputSchema.safeParse({ ...values, due_date: '2026-02-30' }).success,
  ).toBe(false)
  expect(
    taskInputSchema.parse({ ...values, due_date: '2028-02-29' }).due_date,
  ).toBe('2028-02-29')
  expect(taskInputSchema.parse({ ...values, due_date: '' }).due_date).toBeNull()
})

test('loads one page of one column and keeps the backend count', async () => {
  /** Checks that a next URL does not start another request. */
  const signal = new AbortController().signal
  const session = { access: 'test-access' }
  const results = [makeTask({ id: 2 }), makeTask({ id: 8 })]
  vi.mocked(requestWithSession).mockResolvedValueOnce({
    count: 2000,
    next: 'https://external.example/tasks/?page=2',
    results,
  })

  const page = await getTasks(
    session,
    { assignee: 'all', search: '', due: 'all' },
    'planned',
    1,
    signal,
  )

  expect(page.count).toBe(2000)
  expect(page.results).toEqual(results)
  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    '/api/tasks/?page=1&status=planned',
    session,
    { signal },
  )
})

test('sends search and assignee filters on later pages', async () => {
  /** Keeps pagination and filtering on the same local endpoint. */
  vi.mocked(requestWithSession).mockResolvedValue({
    count: 26,
    next: null,
    results: [makeTask()],
  })
  await getTasks(
    { access: 'test-access' },
    { assignee: 7, search: 'report & notes', due: 'overdue' },
    'blocked',
    2,
  )
  const path = vi.mocked(requestWithSession).mock.calls[0][0]
  const params = new URL(path, 'http://localhost').searchParams
  expect(Object.fromEntries(params)).toEqual({
    page: '2',
    status: 'blocked',
    assigned_to: '7',
    search: 'report & notes',
    due: 'overdue',
  })
})

test('sends status changes to the status endpoint', async () => {
  /** Uses the small status response instead of expecting a full task. */
  const session = { access: 'test-access' }
  vi.mocked(requestWithSession).mockResolvedValueOnce({ status: 'done' })

  await expect(updateTaskStatus(session, 4, 'done')).resolves.toBe('done')

  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    '/api/tasks/4/status/',
    session,
    { method: 'patch', data: { status: 'done' } },
  )
})

test('accepts an empty response when deleting a task', async () => {
  /** Handles the API's 204 response without trying to read JSON. */
  const session = { access: 'test-access' }
  vi.mocked(requestWithSession).mockResolvedValueOnce('')

  await expect(deleteTask(session, 4)).resolves.toBeUndefined()

  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    '/api/tasks/4/',
    session,
    { method: 'delete' },
  )
})

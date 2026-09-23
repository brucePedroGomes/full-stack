import { expect, test, vi } from 'vitest'
import { PAGE_SIZE } from '@/config'
import { requestWithSession } from '@/api/session'
import { deleteTask, getTasks, updateTaskStatus } from '@/api/tasks'
import { makeTask } from '../support/fixtures'

vi.mock('@/api/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/session')>()),
  requestWithSession: vi.fn(),
}))

test('loads only the requested page and keeps the backend count', async () => {
  /** Checks that a next URL does not start another request. */
  const signal = new AbortController().signal
  const session = { access: 'test-access' }
  const results = [makeTask({ id: 2 }), makeTask({ id: 8 })]
  vi.mocked(requestWithSession).mockResolvedValueOnce(
    Response.json({
      count: 2000,
      next: 'https://external.example/tasks/?page=2',
      results,
    }),
  )

  const page = await getTasks(
    session,
    { status: 'planned', assignee: 'all', search: '', due_date: '' },
    1,
    signal,
  )

  expect(page.count).toBe(2000)
  expect(page.results).toEqual(results)
  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    `/api/tasks/?page=1&page_size=${PAGE_SIZE}&ordering=-id&status=planned`,
    session,
    { signal },
  )
})

test('sends status, search, and assignee filters on later pages', async () => {
  /** Keeps pagination and filtering on the same local endpoint. */
  vi.mocked(requestWithSession).mockResolvedValue(
    Response.json({ count: 26, next: null, results: [makeTask()] }),
  )
  await getTasks(
    { access: 'test-access' },
    {
      status: 'planned',
      assignee: 7,
      search: 'report & notes',
      due_date: '2026-10-10',
    },
    2,
  )
  const path = vi.mocked(requestWithSession).mock.calls[0][0]
  const params = new URL(path, 'http://localhost').searchParams
  expect(Object.fromEntries(params)).toEqual({
    page: '2',
    page_size: String(PAGE_SIZE),
    ordering: '-id',
    status: 'planned',
    assigned_to: '7',
    search: 'report & notes',
    due_date: '2026-10-10',
  })
})

test('sends status changes to the status endpoint', async () => {
  /** Uses the small status response instead of expecting a full task. */
  const session = { access: 'test-access' }
  vi.mocked(requestWithSession).mockResolvedValueOnce(
    Response.json({ status: 'done' }),
  )

  await expect(updateTaskStatus(session, 4, 'done')).resolves.toBe('done')

  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    '/api/tasks/4/status/',
    session,
    { method: 'patch', json: { status: 'done' } },
  )
})

test('accepts an empty response when deleting a task', async () => {
  /** Handles the API's 204 response without trying to read JSON. */
  const session = { access: 'test-access' }
  vi.mocked(requestWithSession).mockResolvedValueOnce(
    new Response(null, { status: 204 }),
  )

  await expect(deleteTask(session, 4)).resolves.toBeUndefined()

  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    '/api/tasks/4/',
    session,
    { method: 'delete' },
  )
})

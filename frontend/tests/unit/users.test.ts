import { expect, test, vi } from 'vitest'
import { PAGE_SIZE } from '@/config'
import { getAllUsers, getUsers } from '@/api/users'
import { requestWithSession } from '@/api/session'
import { makeUser } from '../support/fixtures'

vi.mock('@/api/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/session')>()),
  requestWithSession: vi.fn(),
}))

test('loads one user page with search and cancellation', async () => {
  /** Keep requests on the local endpoint without downloading the whole directory. */
  const signal = new AbortController().signal
  const session = { access: 'test-access' }
  const result = {
    count: 50,
    next: 'https://external.example/?page=3',
    results: [],
  }
  vi.mocked(requestWithSession).mockResolvedValueOnce(result)
  await expect(getUsers(session, 'Ana Silva', 2, signal)).resolves.toEqual(
    result,
  )
  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    `/api/users/?page=2&page_size=${PAGE_SIZE}&search=Ana+Silva`,
    session,
    { signal },
  )
})

test('loads all dropdown options through local paginated requests', async () => {
  /** Includes later pages without following response URLs to another origin. */
  const signal = new AbortController().signal
  const session = { access: 'test-access' }
  const first = makeUser()
  const last = makeUser({ id: 2, username: 'bruno' })
  vi.mocked(requestWithSession)
    .mockResolvedValueOnce({
      count: 2,
      next: 'https://external.example/?page=2',
      results: [first],
    })
    .mockResolvedValueOnce({ count: 2, next: null, results: [last] })

  await expect(getAllUsers(session, signal)).resolves.toEqual([first, last])
  expect(requestWithSession).toHaveBeenNthCalledWith(
    1,
    `/api/users/?page=1&page_size=${PAGE_SIZE}`,
    session,
    { signal },
  )
  expect(requestWithSession).toHaveBeenNthCalledWith(
    2,
    `/api/users/?page=2&page_size=${PAGE_SIZE}`,
    session,
    { signal },
  )
  expect(requestWithSession).toHaveBeenCalledTimes(2)
})

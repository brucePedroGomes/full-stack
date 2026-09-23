import { expect, test, vi } from 'vitest'
import { PAGE_SIZE } from '@/config'
import { getUsers } from '@/api/users'
import { requestWithSession } from '@/api/session'

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

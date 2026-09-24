import { expect, test, vi } from 'vitest'
import { getUsers } from '@/api/users'
import { requestWithSession } from '@/api/session'
import { makeUser } from '../support/fixtures'

vi.mock('@/api/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/session')>()),
  requestWithSession: vi.fn(),
}))

test('requests 20 users once and does not follow the next page', async () => {
  const signal = new AbortController().signal
  const session = { access: 'test-access' }
  const users = [makeUser()]
  vi.mocked(requestWithSession).mockResolvedValue({
    count: 50,
    next: 'https://external.example/?page=2',
    results: users,
  })

  await expect(getUsers(session, signal)).resolves.toEqual(users)
  expect(requestWithSession).toHaveBeenCalledExactlyOnceWith(
    '/api/users/?page=1&page_size=20',
    session,
    { signal },
  )
})

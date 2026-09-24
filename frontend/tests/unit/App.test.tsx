import { beforeEach, expect, test, vi } from 'vitest'
import { screen } from '@testing-library/react'
import App from '@/App'
import {
  requestWithSession,
  sessionQuery,
  SessionExpiredError,
  signOut,
} from '@/api/session'
import { makeSignedInSession, makeTask } from '../support/fixtures'
import { createTestQueryClient, renderWithQuery } from './render'

vi.mock('@/api/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/session')>()
  return {
    ...actual,
    sessionQuery: { ...actual.sessionQuery, queryFn: vi.fn(async () => null) },
    signIn: vi.fn(async () => makeSignedInSession().session),
    getAccount: vi.fn(async () => makeSignedInSession().account),
    signOut: vi.fn(async () => undefined),
    requestWithSession: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(requestWithSession).mockImplementation(async (path) => {
    const tasks =
      path.startsWith('/api/tasks/') && path.includes('status=planned') ? [makeTask()] : []
    return { count: tasks.length, next: null, results: tasks }
  })
})

function openSignedInApp() {
  const client = createTestQueryClient()
  client.setQueryData(sessionQuery.queryKey, makeSignedInSession())
  return renderWithQuery(<App />, client)
}

test('shows the account and tasks after login', async () => {
  /** Opens the task list after submitting valid credentials. */
  const { user } = renderWithQuery(<App />)

  await user.type(await screen.findByLabelText('Username'), 'ana')
  await user.type(screen.getByLabelText('Password'), 'example-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeVisible()
  expect(await screen.findByText('Prepare report')).toBeVisible()
  expect(screen.getByText('ana')).toBeVisible()
})

test('signs out and returns to login', async () => {
  /** Clears the signed-in workspace on sign-out. */
  const { user } = openSignedInApp()

  await user.click(await screen.findByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(signOut).toHaveBeenCalledOnce()
})

test('returns to login when the session expires', async () => {
  /** Clears the workspace when an API request rejects the session. */
  vi.mocked(requestWithSession).mockRejectedValueOnce(
    new SessionExpiredError('Your session has expired. Please sign in again.'),
  )
  openSignedInApp()

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent(
    'Your session has expired. Please sign in again.',
  )
})

test('opens a cached session without asking the user to sign in', async () => {
  /** Restores the workspace from the session query. */
  openSignedInApp()

  expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeVisible()
  expect(await screen.findByText('Prepare report')).toBeVisible()
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
})

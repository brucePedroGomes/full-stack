import { afterEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getTasks, restoreSession, SessionExpiredError, signOut } from '@/lib/api'
import App from './App'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    signIn: vi.fn(async () => ({ access: 'test-access' })),
    restoreSession: vi.fn(async () => null),
    signOut: vi.fn(async () => undefined),
    getAccount: vi.fn(async () => ({ id: 1, username: 'ana', email: 'ana@example.com' })),
    getTasks: vi.fn(async () => ({
      count: 1,
      results: [{ id: 4, title: 'Prepare report', status: 'in_progress', due_date: null }],
    })),
  }
})

afterEach(cleanup)

test('shows the account and tasks after login, then signs out', async () => {
  /** Checks the home view after login and clears it on sign-out. */
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  await user.type(await screen.findByLabelText('Username'), 'ana')
  await user.type(screen.getByLabelText('Password'), 'example-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Welcome back, ana.')).toBeTruthy()
  expect(await screen.findByText('Prepare report')).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeTruthy()
  expect(signOut).toHaveBeenCalled()
})

test('returns to login when the session expires', async () => {
  /** Checks that an expired browser session clears the signed-in page. */
  vi.mocked(getTasks).mockRejectedValueOnce(
    new SessionExpiredError('Your session has expired. Please sign in again.'),
  )
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  await user.type(await screen.findByLabelText('Username'), 'ana')
  await user.type(screen.getByLabelText('Password'), 'example-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('Your session has expired. Please sign in again.')
})

test('restores the signed-in page after a fresh render', async () => {
  /** Checks that Django's browser session restores the home page. */
  vi.mocked(restoreSession).mockResolvedValueOnce({ access: 'restored-access' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Welcome back, ana.')).toBeTruthy()
  expect(await screen.findByText('Prepare report')).toBeTruthy()
})

import { expect, test } from './support/workspace'
import { mockApi } from './support/mock-api'

test('signs in with CSRF protection and signs out', async ({ page }) => {
  /** Checks real Axios form encoding and browser-session headers. */
  await mockApi(page)
  await page.route('**/api/auth/browser/token/', (route) =>
    route.fulfill({ status: 401 }),
  )
  await page.goto('/')
  await page.getByLabel('Username').fill('ana')
  await page.getByLabel('Password').fill('password & spaces')
  const loginRequest = page.waitForRequest('**/api/auth/browser/login/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const request = await loginRequest
  expect(request.headers()['x-csrftoken']).toBe('test-csrf')
  expect(request.headers()['content-type']).toContain(
    'application/x-www-form-urlencoded',
  )
  expect(Object.fromEntries(new URLSearchParams(request.postData()!))).toEqual({
    username: 'ana',
    password: 'password & spaces',
  })
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }),
  ).toBeVisible()
  const logoutRequest = page.waitForRequest('**/api/auth/browser/logout/')
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await logoutRequest).headers()['x-csrftoken']).toBe('test-csrf')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('shows a clear error for incorrect credentials', async ({ page }) => {
  /** Converts the Axios 401 response into the login message. */
  await mockApi(page)
  await page.route('**/api/auth/browser/token/', (route) =>
    route.fulfill({ status: 401 }),
  )
  await page.route('**/api/auth/browser/login/', (route) =>
    route.fulfill({ status: 401 }),
  )
  await page.goto('/')
  await page.getByLabel('Username').fill('ana')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'The username or password is incorrect.',
  )
})

test('returns to login when the session expires during a status change', async ({
  page,
  workspace,
}) => {
  /** Clears task data after a rejected session refresh. */
  await workspace.open()
  await page.route('**/api/tasks/4/status/', (route) =>
    route.fulfill({ status: 401 }),
  )
  await page.route('**/api/auth/browser/token/', (route) =>
    route.fulfill({ status: 401 }),
  )
  await page.getByLabel('Status for Prepare report').selectOption('done')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(
    'Your session has expired. Please sign in again.',
  )
  await expect(page.getByRole('list', { name: 'Tasks' })).toHaveCount(0)
})

test('returns to login when the session expires during user search', async ({
  page,
  workspace,
}) => {
  /** Applies the session flow to user requests too. */
  await workspace.open()
  await page.route(
    (url) => url.pathname === '/api/users/',
    (route) => route.fulfill({ status: 401 }),
  )
  await page.route('**/api/auth/browser/token/', (route) =>
    route.fulfill({ status: 401 }),
  )
  await page.getByText('Find a user', { exact: true }).click()
  await page.getByLabel('Search users').fill('Bruno')
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(
    'Your session has expired. Please sign in again.',
  )
})

test('renews an expired access token and retries the write', async ({
  page,
  workspace,
}) => {
  /** Keeps the user signed in when the browser session is valid. */
  await workspace.open()
  let attempts = 0
  await page.route('**/api/tasks/4/status/', async (route) => {
    attempts += 1
    if (attempts === 1) await route.fulfill({ status: 401 })
    else await route.fallback()
  })
  await page.getByLabel('Status for Prepare report').selectOption('done')
  await expect(page.getByLabel('Status for Prepare report')).toHaveValue('done')
  expect(attempts).toBe(2)
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }),
  ).toBeVisible()
})

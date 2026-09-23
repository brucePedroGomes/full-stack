import { PAGE_SIZE } from '@/config'
import { makeUser } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('pages and searches users inside the task dialog', async ({
  page,
  workspace,
}) => {
  /** Keeps the selected user when search results change. */
  const users = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
    makeUser({
      id: i + 1,
      username: `user${String(i).padStart(3, '0')}`,
      first_name: `Person ${i + 1}`,
      last_name: '',
    }),
  )
  await workspace.open({ users })
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Find a user', { exact: true }).click()
  const pages = dialog.getByRole('navigation', { name: 'User pages' })
  await pages.getByRole('button', { name: 'Next' }).click()
  await expect(dialog.getByLabel('Assigned to')).toContainText(
    `Person ${PAGE_SIZE + 1}`,
  )
  await dialog.getByLabel('Assigned to').selectOption(String(PAGE_SIZE + 1))
  await dialog.getByLabel('Search users').fill('user000')
  await dialog.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(pages).toContainText('Page 1')
  await expect(dialog.getByLabel('Assigned to')).toContainText('Person 1')
  await expect(dialog.getByLabel('Assigned to')).toHaveValue(
    String(PAGE_SIZE + 1),
  )
  expect(workspace.userRequests.at(-1)?.searchParams.get('search')).toBe(
    'user000',
  )
  await dialog.getByLabel('Title', { exact: true }).fill('Assigned task')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(page.getByRole('list', { name: 'Tasks' })).toContainText(
    `Person ${PAGE_SIZE + 1}`,
  )
})

test('can retry a failed user search', async ({ page, workspace }) => {
  /** Recovers the user field without closing the task form. */
  await workspace.open()
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const search = (url: URL) =>
    url.pathname === '/api/users/' && url.searchParams.get('search') === 'Bruno'
  await page.route(search, (route) =>
    route.fulfill({ status: 400, json: { detail: 'User search failed.' } }),
  )
  await dialog.getByText('Find a user', { exact: true }).click()
  await dialog.getByLabel('Search users').fill('Bruno')
  await dialog.getByLabel('Search users').press('Enter')
  await expect(dialog.getByRole('alert')).toContainText('User search failed.')
  await page.unroute(search)
  await dialog.getByRole('button', { name: 'Retry users' }).click()
  await expect(dialog.getByLabel('Assigned to')).toContainText('Bruno Costa')
  await expect(dialog.getByRole('heading', { name: 'New task' })).toBeVisible()
})

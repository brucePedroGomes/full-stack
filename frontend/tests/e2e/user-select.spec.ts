import { PAGE_SIZE } from '@/config'
import { makeTask, makeUser } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('selects users from every page with a normal dropdown', async ({
  page,
  workspace,
}) => {
  /** Makes later users available in both assignment and filtering. */
  const users = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
    makeUser({
      id: i + 1,
      username: `user${String(i).padStart(3, '0')}`,
      first_name: `Person ${i + 1}`,
      last_name: '',
    }),
  )
  await workspace.open({ users })
  const lastUser = String(PAGE_SIZE + 1)
  await expect(page.getByLabel('Filter by assignee')).toContainText(
    `Person ${lastUser}`,
  )
  expect(workspace.userRequests.map((url) => url.searchParams.get('page'))).toEqual([
    '1',
    '2',
  ])
  await expect(page.getByText('Find a user', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Search users')).toHaveCount(0)
  await expect(dialog.getByRole('navigation', { name: 'User pages' })).toHaveCount(0)
  await dialog.getByLabel('Assigned to').selectOption(lastUser)
  await dialog.getByLabel('Title', { exact: true }).fill('Assigned task')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(page.getByRole('region', { name: 'Task board' })).toContainText(
    `Person ${lastUser}`,
  )
  await page.getByLabel('Filter by assignee').selectOption(lastUser)
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(
    page.getByRole('region', { name: 'Task board' }).getByRole('heading', { level: 3 }),
  ).toHaveText(['Assigned task'])
  expect(workspace.userRequests).toHaveLength(2)
  await page.reload()
  await page.getByRole('button', { name: 'Edit Assigned task' }).click()
  await expect(dialog.getByLabel('Assigned to')).toHaveValue(lastUser)
})

test('retries loading users and keeps the current assignee', async ({
  page,
  workspace,
}) => {
  /** Recovers the dropdown without clearing an existing assignment. */
  await workspace.open({ tasks: [makeTask({ assigned_to: 2 })] })
  const userList = (url: URL) => url.pathname === '/api/users/'
  await page.route(userList, (route) =>
    route.fulfill({ status: 400, json: { detail: 'Could not load users.' } }),
  )
  await page.reload()
  await page.getByRole('button', { name: 'Edit Prepare report' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('Could not load users.')
  await expect(dialog.getByLabel('Assigned to')).toHaveValue('2')
  await expect(dialog.getByLabel('Assigned to')).toContainText('Bruno Costa')
  await page.unroute(userList)
  await dialog.getByRole('button', { name: 'Retry users' }).click()
  await expect(dialog.getByLabel('Assigned to')).toContainText('Ana Silva')
  await expect(dialog.getByLabel('Assigned to')).toHaveValue('2')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})

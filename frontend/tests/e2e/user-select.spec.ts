import { chooseOption } from './support/select'
import { USER_PAGE_SIZE } from '@/config'
import { makeTask, makeUser } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('shares 20 users between tasks and filters and keeps an existing assignee', async ({
  page,
  workspace,
}) => {
  const users = Array.from({ length: USER_PAGE_SIZE + 1 }, (_, i) =>
    makeUser({
      id: i + 1,
      username: `user${String(i).padStart(3, '0')}`,
      first_name: `Person ${i + 1}`,
      last_name: '',
    }),
  )
  await workspace.open({
    users,
    tasks: [makeTask({ assigned_to: USER_PAGE_SIZE + 1 })],
  })
  const lastUser = String(USER_PAGE_SIZE)
  await expect.poll(() => workspace.userRequests.length).toBe(1)
  expect(workspace.userRequests[0].searchParams.get('page')).toBe('1')
  expect(workspace.userRequests[0].searchParams.get('page_size')).toBe('20')
  await page.getByRole('button', { name: 'Edit Prepare report' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Assigned to')).toHaveText(`Person ${USER_PAGE_SIZE + 1}`)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByText('Find a user', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  await expect(dialog.getByLabel('Search users')).toHaveCount(0)
  await expect(dialog.getByRole('navigation', { name: 'User pages' })).toHaveCount(0)
  await chooseOption(page, dialog.getByLabel('Assigned to'), `Person ${lastUser}`)
  await dialog.getByLabel('Title', { exact: true }).fill('Assigned task')
  await dialog.getByRole('button', { name: 'Save task' }).click()
  await expect(page.getByRole('region', { name: 'Task board' })).toContainText(
    `Person ${lastUser}`,
  )
  await chooseOption(page, page.getByLabel('Filter by assignee'), `Person ${lastUser}`)
  await expect(
    page.getByRole('region', { name: 'Task board' }).getByRole('heading', { level: 3 }),
  ).toHaveText(['Assigned task'])
  expect(workspace.userRequests).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: 'Edit Assigned task' }).click()
  await expect(dialog.getByLabel('Assigned to')).toHaveText(`Person ${lastUser}`)
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
  await expect(dialog.getByLabel('Assigned to')).toHaveText('Bruno Costa')
  await page.unroute(userList)
  await dialog.getByRole('button', { name: 'Retry users' }).click()
  await dialog.getByLabel('Assigned to').click()
  await expect(page.getByRole('option', { name: 'Ana Silva' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog.getByLabel('Assigned to')).toHaveText('Bruno Costa')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})

import { makeTask, makeTasks } from '../support/fixtures'
import { PAGE_SIZE } from '@/config'
import { expect, test } from './support/workspace'

test('sends filters to the server and resets pagination', async ({
  page,
  workspace,
}) => {
  /** Finds tasks through combined API filters, starting on page one. */
  await workspace.open({
    tasks: [
      ...makeTasks(PAGE_SIZE + 1),
      makeTask({
        id: 100,
        title: 'Find this report',
        status: 'done',
        assigned_to: 2,
      }),
    ],
  })
  await page
    .getByRole('navigation', { name: 'Task pages' })
    .getByRole('button', { name: 'Next' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Task 1', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Search tasks').fill('Find this')
  await page.getByLabel('Filter by status').selectOption('done')
  await page.getByLabel('Filter by due date').fill('2026-10-10')
  await page.getByLabel('Filter by assignee').selectOption('2')
  const count = workspace.taskRequests.length
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(
    page.getByRole('region', { name: 'Task board' }).getByRole('heading', { level: 3 }),
  ).toHaveText(['Find this report'])
  expect(workspace.taskRequests).toHaveLength(count + 1)
  expect(
    Object.fromEntries(workspace.taskRequests.at(-1)!.searchParams),
  ).toMatchObject({
    page: '1',
    status: 'done',
    search: 'Find this',
    assigned_to: '2',
    due_date: '2026-10-10',
  })
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByLabel('Search tasks')).toHaveValue('')
  await expect(page.getByLabel('Filter by status')).toHaveValue('all')
  await expect(page.getByLabel('Filter by due date')).toHaveValue('')
  await expect(page.getByLabel('Filter by assignee')).toHaveValue('all')
  await expect(
    page.getByRole('region', { name: 'Task board' }).getByRole('heading', { level: 3 }),
  ).toHaveCount(PAGE_SIZE)
})

test('filters unassigned tasks and handles no results', async ({
  page,
  workspace,
}) => {
  /** Sends the unassigned filter and shows an empty result clearly. */
  await workspace.open({ tasks: [makeTask({ assigned_to: 1 })] })
  await page.getByLabel('Filter by assignee').selectOption('unassigned')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByText('No tasks found.')).toBeVisible()
  expect(workspace.taskRequests.at(-1)?.searchParams.get('unassigned')).toBe(
    'true',
  )
})

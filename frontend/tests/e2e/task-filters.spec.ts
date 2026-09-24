import { chooseOption } from './support/select'
import { taskStatuses } from '@/api/tasks'
import { makeTask, makeTasks } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('applies each filter to every column automatically', async ({ page, workspace }) => {
  /** Finds tasks through combined API filters in all columns. */
  await workspace.open({
    tasks: [
      ...makeTasks(3),
      makeTask({ id: 100, title: 'Find this report', assigned_to: 2, is_overdue: true }),
      makeTask({ id: 101, title: 'On time report', assigned_to: 2 }),
    ],
  })
  const board = page.getByRole('region', { name: 'Task board' })
  await expect(page.getByRole('button', { name: 'Apply filters' })).toHaveCount(0)
  await chooseOption(page, page.getByLabel('Filter by due date'), 'Overdue')
  await expect.poll(() => workspace.taskRequests.at(-1)?.searchParams.get('due')).toBe('overdue')
  await chooseOption(page, page.getByLabel('Filter by assignee'), 'Bruno Costa')
  await page.getByLabel('Search tasks').fill('report')
  await expect(board.getByRole('heading', { level: 3 })).toHaveText(['Find this report'])
  const searched = () =>
    workspace.taskRequests.filter((url) => url.searchParams.get('search') === 'report')
  await expect
    .poll(() => new Set(searched().map((url) => url.searchParams.get('status'))).size)
    .toBe(taskStatuses.length)
  for (const url of searched()) {
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      page: '1',
      assigned_to: '2',
      due: 'overdue',
    })
  }
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByLabel('Search tasks')).toHaveValue('')
  await expect(page.getByLabel('Filter by due date')).toHaveText('Any due date')
  await expect(page.getByLabel('Filter by assignee')).toHaveText('All assignees')
  await expect(board.getByRole('heading', { level: 3 })).toHaveCount(5)
})

test('filters unassigned tasks and handles no results', async ({ page, workspace }) => {
  /** Sends the unassigned filter and shows each empty column. */
  await workspace.open({ tasks: [makeTask({ assigned_to: 1 })] })
  await chooseOption(page, page.getByLabel('Filter by assignee'), 'Unassigned')
  const board = page.getByRole('region', { name: 'Task board' })
  await expect(board.getByText('No tasks', { exact: true })).toHaveCount(5)
  expect(workspace.taskRequests.at(-1)?.searchParams.get('unassigned')).toBe('true')
})

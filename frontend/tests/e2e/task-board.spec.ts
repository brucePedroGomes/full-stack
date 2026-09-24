import { chooseOption } from './support/select'
import { taskStatuses } from '@/api/tasks'
import { makeTask } from '../support/fixtures'
import { expect, test } from './support/workspace'

test('groups tasks by status and keeps all columns when filtered', async ({
  page,
  workspace,
}, testInfo) => {
  /** Shows every workflow stage and moves a saved card to its new column. */
  await workspace.open({
    tasks: taskStatuses.map((status, index) =>
      makeTask({ id: index + 1, title: `${status.label} task`, status: status.value }),
    ),
  })
  const board = page.getByRole('region', { name: 'Task board' })
  await expect(board.getByRole('heading', { level: 2 })).toHaveText(
    taskStatuses.map((status) => status.label),
  )
  for (const status of taskStatuses) {
    const column = board.getByRole('region', { name: status.label, exact: true })
    await expect(column.getByRole('heading', { level: 3 })).toHaveText(`${status.label} task`)
  }
  await page.screenshot({ path: testInfo.outputPath('desktop-board.png'), fullPage: true })
  await chooseOption(page, page.getByLabel('Status for Planned task'), 'In progress')
  const planned = board.getByRole('region', { name: 'Planned', exact: true })
  const inProgress = board.getByRole('region', { name: 'In progress', exact: true })
  await expect(planned.getByText('No tasks on this page.')).toBeVisible()
  await expect(inProgress.getByRole('heading', { level: 3 })).toHaveText([
    'In progress task',
    'Planned task',
  ])
  await chooseOption(page, page.getByLabel('Filter by status'), 'In progress')
  await expect(board.getByRole('heading', { level: 3 })).toHaveCount(2)
  await expect(board.getByRole('heading', { level: 2 })).toHaveCount(5)
  await page.getByLabel('Search tasks').fill('No matching task')
  await expect(page.getByText('No tasks found.')).toBeVisible()
  await expect(board.getByRole('heading', { level: 2 })).toHaveCount(5)
  await expect(board.getByRole('heading', { level: 3 })).toHaveCount(0)
})

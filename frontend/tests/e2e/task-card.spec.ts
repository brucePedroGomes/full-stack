import { makeTask } from '../support/fixtures'
import { expect, test } from './support/workspace'

test.use({ timezoneId: 'America/Sao_Paulo' })

test('shows readable due dates on the right day', async ({ page, workspace }) => {
  /** The API sends 2026-10-02. A user in São Paulo still sees Oct 2, not Oct 1. */
  await workspace.open({
    tasks: [
      makeTask({ id: 1, title: 'On time report', due_date: '2026-10-02' }),
      makeTask({ id: 2, title: 'Late report', due_date: '2026-09-20', is_overdue: true }),
    ],
  })
  const cards = page.getByRole('region', { name: 'Task board' }).getByRole('listitem')
  await expect(cards.filter({ hasText: 'On time report' })).toContainText('Due Oct 2, 2026')
  await expect(cards.filter({ hasText: 'Late report' })).toContainText('Overdue · Sep 20, 2026')
})

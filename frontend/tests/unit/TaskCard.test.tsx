import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskCard } from '@/components/TaskCard'
import { makeTask, makeUser } from '../support/fixtures'

test('shows an overdue task with its assignee', () => {
  const task = makeTask({ is_overdue: true, assignee: makeUser() })
  render(<TaskCard task={task} moving={false} onMove={vi.fn()} onEdit={vi.fn()} />)

  expect(screen.getByText('Overdue ·', { exact: false })).toHaveTextContent('Oct 10, 2026')
  expect(screen.getByText('Ana Silva')).toBeVisible()
})

test('shows empty fields and blocks changes while moving', () => {
  const task = makeTask({ description: '', due_date: null })
  render(<TaskCard task={task} moving onMove={vi.fn()} onEdit={vi.fn()} />)

  expect(screen.getByText('No due date')).toBeVisible()
  expect(screen.getByText('Unassigned')).toBeVisible()
  expect(screen.getByText('Moving...')).toBeVisible()
  expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false')
})

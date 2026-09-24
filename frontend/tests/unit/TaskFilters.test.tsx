import { useCallback, useState } from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defaultFilters, type TaskFilters as Filters } from '@/api/tasks'
import { TaskFilters } from '@/components/TaskFilters'
import { makeSignedInSession, makeUsers } from '../support/fixtures'
import { createTestQueryClient, renderWithQuery } from './render'

const { session } = makeSignedInSession()
const onSessionExpired = vi.fn()

function FilterHarness({ onApply }: { onApply: (filters: Filters) => void }) {
  const [filters, setFilters] = useState(defaultFilters)
  const handleApply = useCallback(
    (value: Filters) => {
      setFilters(value)
      onApply(value)
    },
    [onApply],
  )

  return (
    <TaskFilters
      session={session}
      filters={filters}
      onApply={handleApply}
      onSessionExpired={onSessionExpired}
    />
  )
}

function openFilters() {
  const client = createTestQueryClient()
  client.setQueryData(['users', 'all'], makeUsers())
  const onApply = vi.fn()
  return {
    onApply,
    ...renderWithQuery(<FilterHarness onApply={onApply} />, client),
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('applies search once after typing stops', () => {
  /** Avoids requests for each keystroke and trims the final query. */
  const { onApply } = openFilters()
  const search = screen.getByLabelText('Search tasks')
  fireEvent.change(search, { target: { value: 'Fir' } })
  act(() => vi.advanceTimersByTime(200))
  fireEvent.change(search, { target: { value: ' First draft ' } })
  act(() => vi.advanceTimersByTime(299))
  expect(onApply).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    ...defaultFilters,
    search: 'First draft',
  })
})

test('applies selections immediately and keeps them when search finishes', () => {
  /** A pending search must not restore older filter values. */
  const { onApply } = openFilters()
  fireEvent.change(screen.getByLabelText('Search tasks'), {
    target: { value: 'report' },
  })
  fireEvent.change(screen.getByLabelText('Filter by status'), {
    target: { value: 'done' },
  })
  expect(onApply).toHaveBeenLastCalledWith({ ...defaultFilters, status: 'done' })
  fireEvent.change(screen.getByLabelText('Filter by due date'), {
    target: { value: '2026-10-10' },
  })
  expect(onApply).toHaveBeenLastCalledWith({
    ...defaultFilters,
    status: 'done',
    due_date: '2026-10-10',
  })
  fireEvent.change(screen.getByLabelText('Filter by assignee'), {
    target: { value: '2' },
  })
  expect(onApply).toHaveBeenLastCalledWith({
    ...defaultFilters,
    status: 'done',
    due_date: '2026-10-10',
    assignee: 2,
  })
  act(() => vi.advanceTimersByTime(300))
  expect(onApply).toHaveBeenLastCalledWith({
    search: 'report',
    status: 'done',
    due_date: '2026-10-10',
    assignee: 2,
  })
})

test('reset clears all controls and cancels a pending search', () => {
  /** Waiting after Reset must not bring back the previous search. */
  const { onApply } = openFilters()
  fireEvent.change(screen.getByLabelText('Filter by status'), {
    target: { value: 'blocked' },
  })
  fireEvent.change(screen.getByLabelText('Filter by due date'), {
    target: { value: '2026-10-10' },
  })
  fireEvent.change(screen.getByLabelText('Filter by assignee'), {
    target: { value: '2' },
  })
  fireEvent.change(screen.getByLabelText('Search tasks'), {
    target: { value: 'old search' },
  })
  act(() => vi.advanceTimersByTime(200))
  onApply.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByLabelText('Search tasks')).toHaveValue('')
  expect(screen.getByLabelText('Filter by status')).toHaveValue('all')
  expect(screen.getByLabelText('Filter by due date')).toHaveValue('')
  expect(screen.getByLabelText('Filter by assignee')).toHaveValue('all')
  act(() => vi.advanceTimersByTime(300))
  expect(onApply).toHaveBeenCalledExactlyOnceWith(defaultFilters)
})

test('clears search and cancels pending work when the filters unmount', () => {
  /** Clearing the input removes the query; leaving the page stops its timer. */
  const { onApply, unmount } = openFilters()
  const search = screen.getByLabelText('Search tasks')
  fireEvent.change(search, { target: { value: 'report' } })
  act(() => vi.advanceTimersByTime(300))
  fireEvent.change(search, { target: { value: '' } })
  act(() => vi.advanceTimersByTime(300))
  expect(onApply).toHaveBeenLastCalledWith(defaultFilters)
  onApply.mockClear()
  fireEvent.change(search, { target: { value: 'unfinished' } })
  unmount()
  act(() => vi.advanceTimersByTime(300))
  expect(onApply).not.toHaveBeenCalled()
})

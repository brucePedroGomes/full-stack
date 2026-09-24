import { useEffect } from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defaultFilters, type TaskFilters as Filters } from '@/api/tasks'
import { usersQuery } from '@/api/users'
import { TaskFilters } from '@/components/TaskFilters'
import { TaskProvider, useTaskContext } from '@/contexts/TaskContext'
import { makeSignedInSession, makeUsers } from '../support/fixtures'
import { createTestQueryClient, renderWithQuery } from './render'

const signedInSession = makeSignedInSession()
const onSessionExpired = vi.fn()

vi.mock('@/api/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/session')>()),
  requestWithSession: vi.fn(async () => ({ count: 0, next: null, results: [] })),
}))

function FilterHarness({ onApply }: { onApply: (filters: Filters) => void }) {
  const { filters } = useTaskContext()
  useEffect(() => onApply(filters), [filters, onApply])
  return <TaskFilters />
}

function openFilters() {
  const client = createTestQueryClient()
  client.setQueryData(usersQuery(signedInSession.session).queryKey, makeUsers())
  const onApply = vi.fn()
  const view = renderWithQuery(
    <TaskProvider {...signedInSession} onSessionExpired={onSessionExpired}>
      <FilterHarness onApply={onApply} />
    </TaskProvider>,
    client,
  )
  onApply.mockClear()
  return { onApply, ...view }
}

function chooseOption(label: string, option: string) {
  fireEvent.click(screen.getByLabelText(label))
  fireEvent.click(screen.getByRole('option', { name: option }))
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
  act(() => vi.advanceTimersByTime(499))
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
  chooseOption('Filter by status', 'Done')
  expect(onApply).toHaveBeenLastCalledWith({ ...defaultFilters, status: 'done' })
  fireEvent.change(screen.getByLabelText('Filter by due date'), {
    target: { value: '2026-10-10' },
  })
  expect(onApply).toHaveBeenLastCalledWith({
    ...defaultFilters,
    status: 'done',
    due_date: '2026-10-10',
  })
  chooseOption('Filter by assignee', 'Bruno Costa')
  expect(onApply).toHaveBeenLastCalledWith({
    ...defaultFilters,
    status: 'done',
    due_date: '2026-10-10',
    assignee: 2,
  })
  act(() => vi.advanceTimersByTime(500))
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
  fireEvent.change(screen.getByLabelText('Search tasks'), {
    target: { value: 'applied search' },
  })
  act(() => vi.advanceTimersByTime(500))
  chooseOption('Filter by status', 'Blocked')
  fireEvent.change(screen.getByLabelText('Filter by due date'), {
    target: { value: '2026-10-10' },
  })
  chooseOption('Filter by assignee', 'Bruno Costa')
  fireEvent.change(screen.getByLabelText('Search tasks'), {
    target: { value: 'old search' },
  })
  act(() => vi.advanceTimersByTime(200))
  onApply.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByLabelText('Search tasks')).toHaveValue('')
  expect(screen.getByLabelText('Filter by status')).toHaveTextContent('All statuses')
  expect(screen.getByLabelText('Filter by due date')).toHaveValue('')
  expect(screen.getByLabelText('Filter by assignee')).toHaveTextContent('All assignees')
  act(() => vi.advanceTimersByTime(500))
  expect(onApply).toHaveBeenCalledExactlyOnceWith(defaultFilters)
})

test('submitting applies the latest search without restoring the previous query', () => {
  const { onApply } = openFilters()
  const search = screen.getByLabelText('Search tasks')
  fireEvent.change(search, { target: { value: 'old search' } })
  act(() => vi.advanceTimersByTime(500))
  onApply.mockClear()

  fireEvent.change(search, { target: { value: ' new search ' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Task filters' }))
  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    ...defaultFilters,
    search: 'new search',
  })

  act(() => vi.advanceTimersByTime(500))
  expect(onApply).toHaveBeenCalledTimes(1)
})

test('clears search and cancels pending work when the filters unmount', () => {
  /** Clearing the input removes the query; leaving the page stops its timer. */
  const { onApply, unmount } = openFilters()
  const search = screen.getByLabelText('Search tasks')
  fireEvent.change(search, { target: { value: 'report' } })
  act(() => vi.advanceTimersByTime(500))
  fireEvent.change(search, { target: { value: '' } })
  act(() => vi.advanceTimersByTime(500))
  expect(onApply).toHaveBeenLastCalledWith(defaultFilters)
  onApply.mockClear()
  fireEvent.change(search, { target: { value: 'unfinished' } })
  unmount()
  act(() => vi.advanceTimersByTime(500))
  expect(onApply).not.toHaveBeenCalled()
})

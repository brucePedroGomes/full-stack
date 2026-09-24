import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type SubmitEvent,
} from 'react'
import type { Session } from '@/api/session'
import {
  defaultFilters,
  taskStatuses,
  type TaskFilters as Filters,
} from '@/api/tasks'
import { UserSelect, type UserSelection } from './UserSelect'

type TaskFiltersProps = {
  session: Session
  filters: Filters
  onApply: (filters: Filters) => void
  onSessionExpired: (message: string) => void
}

export function TaskFilters({
  session,
  filters,
  onApply,
  onSessionExpired,
}: TaskFiltersProps) {
  const [search, setSearch] = useState(filters.search)
  const [assignee, setAssignee] = useState<UserSelection>('all')

  useEffect(() => {
    const nextSearch = search.trim()
    if (nextSearch === filters.search) return

    const timeout = window.setTimeout(() => {
      onApply({ ...filters, search: nextSearch })
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search, filters, onApply])

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearch(event.currentTarget.value)
    },
    [],
  )
  const handleStatusChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      onApply({ ...filters, status: event.currentTarget.value as Filters['status'] })
    },
    [filters, onApply],
  )
  const handleDueDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.currentTarget.validity.valid) return
      onApply({ ...filters, due_date: event.currentTarget.value })
    },
    [filters, onApply],
  )
  const handleAssigneeChange = useCallback(
    (value: UserSelection) => {
      setAssignee(value)
      onApply({
        ...filters,
        assignee: value === 'all' ? 'all' : (value?.id ?? 'unassigned'),
      })
    },
    [filters, onApply],
  )
  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (search.trim() !== filters.search)
        onApply({ ...filters, search: search.trim() })
    },
    [search, filters, onApply],
  )
  const handleReset = useCallback(() => {
    setSearch('')
    setAssignee('all')
    onApply(defaultFilters)
  }, [onApply])

  return (
    <form
      aria-label="Task filters"
      className="grid gap-4 rounded border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={handleSubmit}
      onReset={handleReset}
    >
      <label className="block">
        Search tasks
        <input
          name="search"
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Title or description"
          className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 focus:outline-2 focus:outline-blue-600"
        />
      </label>
      <label className="block">
        Filter by status
        <select
          name="status"
          value={filters.status}
          onChange={handleStatusChange}
          className="mt-1 min-h-11 w-full rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600"
        >
          <option value="all">All statuses</option>
          {taskStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Filter by due date
        <input
          name="due_date"
          type="date"
          max="9999-12-31"
          value={filters.due_date}
          onChange={handleDueDateChange}
          className="mt-1 min-h-11 w-full min-w-0 rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600"
        />
      </label>
      <UserSelect
        label="Filter by assignee"
        session={session}
        value={assignee}
        allowAll
        onChange={handleAssigneeChange}
        onSessionExpired={onSessionExpired}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
        <p className="text-sm text-gray-600">Filters update automatically.</p>
        <button
          type="reset"
          className="min-h-11 rounded border border-gray-300 px-4 hover:bg-gray-100"
        >
          Reset
        </button>
      </div>
    </form>
  )
}

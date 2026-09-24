import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type SubmitEvent,
} from 'react'
import { getApiErrorMessage, type Session } from '@/api/session'
import {
  defaultFilters,
  taskStatuses,
  type TaskFilters as Filters,
} from '@/api/tasks'
import { useDebounce } from '@/hooks/useDebounce'
import { useUserOptions } from '@/hooks/useUserOptions'
import { Button, Input, Select, type SelectOption } from './ui'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  ...taskStatuses,
] as const

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
  const debouncedSearch = useDebounce(search, 500)
  const users = useUserOptions(session, onSessionExpired)
  const assigneeOptions: SelectOption<Filters['assignee']>[] = [
    { value: 'all', label: 'All assignees' },
    { value: 'unassigned', label: 'Unassigned' },
    ...users.options,
  ]

  useEffect(() => {
    const isSearchPending = search !== debouncedSearch
    if (isSearchPending) return

    const trimmedSearch = debouncedSearch.trim()
    const isSearchAlreadyApplied = trimmedSearch === filters.search
    if (isSearchAlreadyApplied) return

    onApply({ ...filters, search: trimmedSearch })
  }, [debouncedSearch, search, filters, onApply])

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearch(event.currentTarget.value)
    },
    [],
  )
  const handleStatusChange = useCallback(
    (value: Filters['status']) => {
      onApply({ ...filters, status: value })
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
    (value: Filters['assignee']) => {
      onApply({ ...filters, assignee: value })
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
    onApply(defaultFilters)
  }, [onApply])

  return (
    <form
      aria-label="Task filters"
      className="grid gap-4 rounded border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={handleSubmit}
      onReset={handleReset}
    >
      <Input
        label="Search tasks"
        name="search"
        type="search"
        value={search}
        onChange={handleSearchChange}
        placeholder="Title or description"
      />
      <Select
        label="Filter by status"
        name="status"
        value={filters.status}
        onChange={handleStatusChange}
        options={statusOptions}
      />
      <Input
        label="Filter by due date"
        name="due_date"
        type="date"
        max="9999-12-31"
        value={filters.due_date}
        onChange={handleDueDateChange}
      />
      <div className="min-w-0 space-y-2">
        <Select
          label="Filter by assignee"
          value={filters.assignee}
          onChange={handleAssigneeChange}
          options={assigneeOptions}
        />
        {users.isPending ? (
          <p role="status" className="text-sm text-gray-600">
            Loading users...
          </p>
        ) : null}
        {users.error ? (
          <div role="alert" className="text-sm text-red-700">
            <p>{getApiErrorMessage(users.error)}</p>
            <Button variant="plain" onClick={users.retry}>
              Retry users
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
        <p className="text-sm text-gray-600">Filters update automatically.</p>
        <Button type="reset">Reset</Button>
      </div>
    </form>
  )
}

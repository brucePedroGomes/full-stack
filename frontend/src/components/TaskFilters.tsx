import { useEffect, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { getApiErrorMessage } from '@/api/session'
import { taskStatuses, type TaskFilters as Filters } from '@/api/tasks'
import { useTaskContext } from '@/contexts/TaskContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useUserOptions } from '@/hooks/useUserOptions'
import { Button, Input, Select, type SelectOption } from './ui'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  ...taskStatuses,
] as const

export function TaskFilters() {
  const { filters, updateFilters, resetFilters } = useTaskContext()
  const [search, setSearch] = useState(filters.search)
  const debouncedSearch = useDebounce(search, 500)
  const users = useUserOptions()
  const assigneeOptions: SelectOption<Filters['assignee']>[] = [
    { value: 'all', label: 'All assignees' },
    { value: 'unassigned', label: 'Unassigned' },
    ...users.options,
  ]

  useEffect(() => {
    const isSearchPending = search !== debouncedSearch
    if (isSearchPending) return

    const trimmedSearch = debouncedSearch.trim()
    if (trimmedSearch !== filters.search) {
      updateFilters({ search: trimmedSearch })
    }
  }, [search, debouncedSearch, filters.search, updateFilters])

  function changeDueDate(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.validity.valid) {
      updateFilters({ due_date: event.currentTarget.value })
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (search.trim() !== filters.search) {
      updateFilters({ search: search.trim() })
    }
  }

  function reset() {
    setSearch('')
    resetFilters()
  }

  return (
    <form
      aria-label="Task filters"
      className="grid gap-4 rounded border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={submit}
      onReset={reset}
    >
      <Input
        label="Search tasks"
        name="search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder="Title or description"
      />
      <Select
        label="Filter by status"
        name="status"
        value={filters.status}
        onChange={(status) => updateFilters({ status })}
        options={statusOptions}
      />
      <Input
        label="Filter by due date"
        name="due_date"
        type="date"
        max="9999-12-31"
        value={filters.due_date}
        onChange={changeDueDate}
      />
      <div className="min-w-0 space-y-2">
        <Select
          label="Filter by assignee"
          value={filters.assignee}
          onChange={(assignee) => updateFilters({ assignee })}
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

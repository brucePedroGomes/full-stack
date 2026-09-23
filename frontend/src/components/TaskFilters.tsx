import { useState } from 'react'
import type { Session } from '@/api/session'
import {
  defaultFilters,
  taskStatuses,
  type TaskFilters as Filters,
} from '@/api/tasks'
import { UserSelect, type UserSelection } from './UserSelect'

type TaskFiltersProps = {
  session: Session
  onApply: (filters: Filters) => void
  onSessionExpired: (message: string) => void
}

export function TaskFilters({
  session,
  onApply,
  onSessionExpired,
}: TaskFiltersProps) {
  const [assignee, setAssignee] = useState<UserSelection>('all')

  return (
    <form
      aria-label="Task filters"
      className="grid gap-4 rounded border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onApply({
          search: String(data.get('search')).trim(),
          status: data.get('status') as Filters['status'],
          due_date: String(data.get('due_date')),
          assignee: assignee === 'all' ? 'all' : (assignee?.id ?? 'unassigned'),
        })
      }}
      onReset={() => {
        setAssignee('all')
        onApply(defaultFilters)
      }}
    >
      <label className="block">
        Search tasks
        <input
          name="search"
          type="search"
          placeholder="Title or description"
          className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 focus:outline-2 focus:outline-blue-600"
        />
      </label>
      <label className="block">
        Filter by status
        <select
          name="status"
          defaultValue="all"
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
          className="mt-1 min-h-11 w-full min-w-0 rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600"
        />
      </label>
      <UserSelect
        label="Filter by assignee"
        session={session}
        value={assignee}
        allowAll
        onChange={setAssignee}
        onSessionExpired={onSessionExpired}
      />
      <div className="flex gap-3 sm:col-span-2 lg:col-span-4">
        <button className="min-h-11 rounded bg-blue-700 px-4 text-white hover:bg-blue-800">
          Apply filters
        </button>
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

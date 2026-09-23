import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getApiErrorMessage,
  SessionExpiredError,
  type Session,
} from '@/api/session'
import { getUserName, usersQuery, type UserSummary } from '@/api/users'
import { Pagination } from './Pagination'

export type UserSelection = UserSummary | 'all' | null
const emptyUsers: UserSummary[] = []

type UserSelectProps = {
  label: string
  session: Session
  value: UserSelection
  allowAll?: boolean
  onChange: (user: UserSelection) => void
  onSessionExpired: (message: string) => void
}

export function UserSelect({
  label,
  session,
  value,
  allowAll = false,
  onChange,
  onSessionExpired,
}: UserSelectProps) {
  const searchInput = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const users = useQuery(usersQuery(session, search, page))
  const selected = typeof value === 'object' ? value : null
  const options = users.data?.results ?? emptyUsers
  const { refetch } = users

  useEffect(() => {
    if (users.error instanceof SessionExpiredError)
      onSessionExpired(users.error.message)
  }, [users.error, onSessionExpired])

  const handleFindUsers = useCallback(() => {
    setSearch(searchInput.current?.value.trim() ?? '')
    setPage(1)
  }, [])
  const handleSelect = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const id = event.currentTarget.value
      if (id === 'all') onChange('all')
      else if (id === 'unassigned') onChange(null)
      else onChange(options.find((user) => user.id === Number(id)) ?? selected)
    },
    [onChange, options, selected],
  )
  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleFindUsers()
      }
    },
    [handleFindUsers],
  )
  const handleRetry = useCallback(() => {
    void refetch()
  }, [refetch])

  return (
    <div className="min-w-0 space-y-2">
      <label className="block">
        {label}
        <select
          value={selected?.id ?? (value === 'all' ? 'all' : 'unassigned')}
          onChange={handleSelect}
          className="mt-1 min-h-11 w-full rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600"
        >
          {allowAll ? <option value="all">All assignees</option> : null}
          <option value="unassigned">Unassigned</option>
          {selected && !options.some((user) => user.id === selected.id) ? (
            <option value={selected.id}>{getUserName(selected)}</option>
          ) : null}
          {options.map((user) => (
            <option key={user.id} value={user.id}>
              {getUserName(user)}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary className="w-fit cursor-pointer py-1 text-sm text-blue-700">
          Find a user
        </summary>
        <div className="mt-2 space-y-3">
          <div className="flex gap-2">
            <input
              ref={searchInput}
              aria-label="Search users"
              placeholder="Name or username"
              type="search"
              onKeyDown={handleSearchKeyDown}
              className="min-h-11 min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600"
            />
            <button
              type="button"
              onClick={handleFindUsers}
              className="min-h-11 rounded border border-gray-300 bg-white px-3 hover:bg-gray-100"
            >
              Find
            </button>
          </div>
          <Pagination
            label="User pages"
            page={page}
            hasNext={Boolean(users.data?.next)}
            busy={users.isFetching}
            onChange={setPage}
          />
          {users.data?.count === 0 ? (
            <p className="text-sm text-gray-600">No users found.</p>
          ) : null}
        </div>
      </details>
      {users.isPending ? (
        <p role="status" className="text-sm text-gray-600">
          Loading users...
        </p>
      ) : null}
      {users.error ? (
        <div role="alert" className="text-sm text-red-700">
          <p>{getApiErrorMessage(users.error)}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="min-h-11 underline"
          >
            Retry users
          </button>
        </div>
      ) : null}
    </div>
  )
}

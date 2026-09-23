import { useCallback, useState, type ReactElement } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAccount,
  getApiErrorMessage,
  sessionQuery,
  signIn,
  signOut,
  type Credentials,
} from './api/session'
import { LoginForm } from './components/LoginForm'
import { TaskPage } from './components/TaskPage'

export default function App(): ReactElement {
  const client = useQueryClient()
  const session = useQuery(sessionQuery)
  const [notice, setNotice] = useState('')
  const endSession = useCallback(
    (message: string) => {
      client.setQueryData(sessionQuery.queryKey, null)
      client.removeQueries({ queryKey: ['tasks'] })
      client.removeQueries({ queryKey: ['users'] })
      setNotice(message)
    },
    [client],
  )
  const login = useMutation({
    networkMode: 'always',
    mutationFn: async (values: Credentials) => {
      const session = await signIn(values.username, values.password)
      return { session, account: await getAccount(session) }
    },
    onSuccess: (data) => {
      client.setQueryData(sessionQuery.queryKey, data)
      setNotice('')
    },
  })
  const logout = useMutation({
    networkMode: 'always',
    mutationFn: signOut,
    onSuccess: () => endSession('You have signed out.'),
  })
  const { mutate: loginUser } = login
  const { mutate: logoutUser } = logout
  const handleSignIn = useCallback(
    (values: Credentials) => {
      loginUser(values)
    },
    [loginUser],
  )
  const handleSignOut = useCallback(() => logoutUser(), [logoutUser])

  if (session.isPending)
    return (
      <p role="status" className="p-6">
        Loading...
      </p>
    )
  if (!session.data) {
    return (
      <LoginForm
        onSignIn={handleSignIn}
        pending={login.isPending}
        error={login.error || session.error}
        notice={notice}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <span className="font-semibold">Task manager</span>
        <div className="flex items-center gap-4">
          <span>{session.data.account.username}</span>
          <button
            className="min-h-11 rounded border border-gray-300 px-4 hover:bg-gray-100 disabled:opacity-50"
            disabled={logout.isPending}
            onClick={handleSignOut}
          >
            {logout.isPending ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>
      {logout.error ? (
        <p role="alert" className="p-4 text-red-700">
          {getApiErrorMessage(logout.error)}
        </p>
      ) : null}
      <TaskPage {...session.data} onSessionExpired={endSession} />
    </div>
  )
}

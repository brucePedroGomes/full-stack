import type { ReactElement } from 'react'
import { getApiErrorMessage } from './api/session'
import { useSession } from './hooks/useSession'
import { LoginForm } from './components/LoginForm'
import { TaskPage } from './components/TaskPage'
import { Button } from './components/ui'
import { TaskProvider } from './contexts/TaskContext'

export default function App(): ReactElement {
  const { session, login, logout, notice, signIn, signOut, endSession } = useSession()

  if (session.isPending)
    return (
      <p role="status" className="p-6">
        Loading...
      </p>
    )
  if (!session.data) {
    return (
      <LoginForm
        onSignIn={signIn}
        pending={login.isPending}
        error={login.error || session.error}
        notice={notice}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 lg:flex lg:h-screen lg:flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <span className="font-semibold">Task manager</span>
        <div className="flex items-center gap-4">
          <span>{session.data.account.username}</span>
          <Button
            disabled={logout.isPending}
            onClick={signOut}
          >
            {logout.isPending ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </header>
      {logout.error ? (
        <p role="alert" className="p-4 text-red-700">
          {getApiErrorMessage(logout.error)}
        </p>
      ) : null}
      <TaskProvider {...session.data} onSessionExpired={endSession}>
        <TaskPage />
      </TaskProvider>
    </div>
  )
}

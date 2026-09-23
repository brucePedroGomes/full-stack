import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HomePage } from '@/components/home-page'
import { LoginPage, type LoginValues } from '@/components/login-page'
import {
  getAccount,
  getApiErrorMessage,
  getTasks,
  SessionExpiredError,
  signIn,
  type Account,
  type Session,
} from '@/lib/api'

function App(): ReactElement {
  const queryClient = useQueryClient()
  const sessionRef = useRef<Session | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [notice, setNotice] = useState('')

  const tasksQuery = useQuery({
    queryKey: ['tasks', account?.id],
    queryFn: ({ signal }) => {
      const session = sessionRef.current
      if (!session) throw new SessionExpiredError('Please sign in again.')
      return getTasks(session, signal)
    },
    enabled: account !== null,
    retry: false,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!(tasksQuery.error instanceof SessionExpiredError)) return
    sessionRef.current = null
    setAccount(null)
    setNotice(tasksQuery.error.message)
    queryClient.clear()
  }, [tasksQuery.error, queryClient])

  async function handleSignIn(values: LoginValues): Promise<void> {
    const session = await signIn(values.username, values.password)
    const signedInAccount = await getAccount(session)
    sessionRef.current = session
    setNotice('')
    setAccount(signedInAccount)
  }

  function handleSignOut(): void {
    sessionRef.current = null
    setAccount(null)
    setNotice('You have signed out of this tab.')
    queryClient.clear()
  }

  function handleRefresh(): void {
    void tasksQuery.refetch()
  }

  if (!account) {
    return <LoginPage onSignIn={handleSignIn} notice={notice} />
  }

  return (
    <HomePage
      account={account}
      tasks={tasksQuery.data ?? null}
      taskError={tasksQuery.error ? getApiErrorMessage(tasksQuery.error) : ''}
      isLoading={tasksQuery.isPending}
      isRefreshing={tasksQuery.isFetching}
      onRefresh={handleRefresh}
      onSignOut={handleSignOut}
    />
  )
}

export default App

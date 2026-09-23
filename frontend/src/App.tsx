import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Brand } from '@/components/brand'
import { HomePage } from '@/components/home-page'
import { LoginPage, type LoginValues } from '@/components/login-page'
import {
  getAccount,
  getApiErrorMessage,
  getTasks,
  restoreSession,
  SessionExpiredError,
  signIn,
  signOut,
  type Account,
  type Session,
} from '@/lib/api'

function App(): ReactElement {
  const queryClient = useQueryClient()
  const sessionRef = useRef<Session | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [notice, setNotice] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function checkSession(): Promise<void> {
      try {
        const session = await restoreSession(controller.signal)
        if (session) {
          const signedInAccount = await getAccount(session, controller.signal)
          if (!controller.signal.aborted) {
            sessionRef.current = session
            setAccount(signedInAccount)
          }
        }
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof SessionExpiredError)) {
          setNotice(getApiErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) setCheckingSession(false)
      }
    }

    void checkSession()
    return () => controller.abort()
  }, [])

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

  async function handleSignOut(): Promise<void> {
    setSigningOut(true)
    setSignOutError('')
    try {
      await signOut()
      sessionRef.current = null
      setAccount(null)
      setNotice('You have signed out.')
      queryClient.clear()
    } catch (error) {
      setSignOutError(getApiErrorMessage(error))
    } finally {
      setSigningOut(false)
    }
  }

  function handleRefresh(): void {
    void tasksQuery.refetch()
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#f7f6f2] text-[#17333b]">
        <Brand />
        <p role="status" className="text-sm text-[#65736f]">Checking your session...</p>
      </div>
    )
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
      isSigningOut={signingOut}
      signOutError={signOutError}
      onRefresh={handleRefresh}
      onSignOut={handleSignOut}
    />
  )
}

export default App

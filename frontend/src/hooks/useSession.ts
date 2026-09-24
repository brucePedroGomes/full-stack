import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAccount,
  sessionQuery,
  signIn,
  signOut,
  type Credentials,
} from '@/api/session'

export function useSession() {
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

  function handleSignOut() {
    logout.mutate()
  }

  return {
    session,
    login,
    logout,
    notice,
    signIn: login.mutate,
    signOut: handleSignOut,
    endSession,
  }
}

import Cookies from 'js-cookie'
import axios, { isAxiosError, type AxiosRequestConfig } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import type { UserSummary } from './users'

const http = axios.create({ adapter: 'fetch', timeout: 10_000 })

export type Account = UserSummary & { email: string }
export type Session = { access: string }
const renewals = new WeakMap<Session, Promise<void>>()

export const credentialsSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
})
export type Credentials = z.infer<typeof credentialsSchema>
export type SignedInSession = { session: Session; account: Account }

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async ({ signal }): Promise<SignedInSession | null> => {
    const session = await restoreSession(signal)
    return session
      ? { session, account: await getAccount(session, signal) }
      : null
  },
  staleTime: Infinity,
  retry: false,
  refetchOnWindowFocus: false,
})

export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message)
  }
}

export function clearSession(session: Session): void {
  session.access = ''
}

function assertSessionActive(session: Session): void {
  if (!session.access) throw new SessionExpiredError()
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof SessionExpiredError) return error.message
  if (isAxiosError(error)) {
    return error.response
      ? 'The server could not finish the request. Please try again.'
      : 'Cannot reach the server. Please check that Django is running.'
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

async function csrfToken(signal?: AbortSignal): Promise<string> {
  if (!Cookies.get('csrftoken')) {
    await http.get('/api/auth/browser/csrf/', { signal })
  }

  const token = Cookies.get('csrftoken')
  if (!token)
    throw new Error('Could not start a secure session. Please try again.')
  return token
}

async function browserPost<T = void>(
  path: string,
  body?: URLSearchParams,
  signal?: AbortSignal,
): Promise<T> {
  const response = await http.post<T>(path, body, {
    headers: { 'X-CSRFToken': await csrfToken(signal) },
    signal,
  })
  return response.data
}

export async function signIn(
  username: string,
  password: string,
): Promise<Session> {
  try {
    return await browserPost<Session>(
      '/api/auth/browser/login/',
      new URLSearchParams({ username, password }),
    )
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      throw new Error('The username or password is incorrect.')
    }
    throw error
  }
}

export async function restoreSession(
  signal?: AbortSignal,
): Promise<Session | null> {
  try {
    return await browserPost<Session>(
      '/api/auth/browser/token/',
      undefined,
      signal,
    )
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) return null
    throw error
  }
}

export async function signOut(session: Session): Promise<void> {
  await browserPost('/api/auth/browser/logout/')
  clearSession(session)
}

function refreshAccess(session: Session): Promise<void> {
  const pending = renewals.get(session)
  if (pending) return pending

  // One caller's cancellation must not cancel renewal for the others.
  const renewal = restoreSession()
    .then((refreshed) => {
      if (!refreshed) {
        clearSession(session)
        throw new SessionExpiredError()
      }
      assertSessionActive(session)
      session.access = refreshed.access
    })
    .finally(() => renewals.delete(session))

  renewals.set(session, renewal)
  return renewal
}

export async function requestWithSession<T = unknown>(
  path: string,
  session: Session,
  {
    signal,
    method = 'get',
    data,
  }: Pick<AxiosRequestConfig<unknown>, 'method' | 'data'> & {
    signal?: AbortSignal
  } = {},
): Promise<T> {
  async function request(): Promise<T> {
    signal?.throwIfAborted()
    assertSessionActive(session)
    try {
      const response = await http.request<T>({
        url: path,
        method,
        data,
        withCredentials: false,
        fetchOptions: { cache: 'no-store' },
        headers: { Authorization: `Bearer ${session.access}` },
        signal,
      })
      signal?.throwIfAborted()
      assertSessionActive(session)
      return response.data
    } catch (error) {
      if (
        isAxiosError<Record<string, string | string[]>>(error) &&
        error.response?.status === 400
      ) {
        throw new Error(Object.values(error.response.data).flat().join(' '))
      }
      throw error
    }
  }

  const access = session.access
  try {
    return await request()
  } catch (error) {
    if (!isAxiosError(error) || error.response?.status !== 401) throw error
  }

  signal?.throwIfAborted()
  assertSessionActive(session)
  // Another request may have renewed the token before this 401 arrived.
  if (session.access === access) await refreshAccess(session)
  try {
    return await request()
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      clearSession(session)
      throw new SessionExpiredError()
    }
    throw error
  }
}

export async function getAccount(
  session: Session,
  signal?: AbortSignal,
): Promise<Account> {
  return requestWithSession<Account>('/api/users/me/', session, {
    signal,
  })
}

import Cookies from 'js-cookie'
import ky, { isHTTPError, isKyError, type Options } from 'ky'
import { queryOptions } from '@tanstack/react-query'
import type { UserSummary } from './users'

export type Account = UserSummary & { email: string }
export type Session = { access: string }
export type Credentials = { username: string; password: string }
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

export class SessionExpiredError extends Error {}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof SessionExpiredError) return error.message
  if (isHTTPError(error)) {
    return 'The server could not finish the request. Please try again.'
  }
  if (isKyError(error))
    return 'Cannot reach the server. Please check that Django is running.'
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

async function csrfToken(signal?: AbortSignal): Promise<string> {
  if (!Cookies.get('csrftoken')) {
    await ky.get('/api/auth/browser/csrf/', {
      credentials: 'same-origin',
      signal,
    })
  }

  const token = Cookies.get('csrftoken')
  if (!token)
    throw new Error('Could not start a secure session. Please try again.')
  return token
}

async function browserPost(
  path: string,
  body?: URLSearchParams,
  signal?: AbortSignal,
): Promise<Response> {
  return ky.post(path, {
    body,
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': await csrfToken(signal) },
    signal,
  })
}

export async function signIn(
  username: string,
  password: string,
): Promise<Session> {
  try {
    const response = await browserPost(
      '/api/auth/browser/login/',
      new URLSearchParams({ username, password }),
    )
    return response.json() as Promise<Session>
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) {
      throw new Error('The username or password is incorrect.')
    }
    throw error
  }
}

export async function restoreSession(
  signal?: AbortSignal,
): Promise<Session | null> {
  try {
    const response = await browserPost(
      '/api/auth/browser/token/',
      undefined,
      signal,
    )
    return response.json() as Promise<Session>
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) return null
    throw error
  }
}

export async function signOut(): Promise<void> {
  await browserPost('/api/auth/browser/logout/')
}

async function refreshAccess(
  session: Session,
  signal?: AbortSignal,
): Promise<void> {
  const refreshed = await restoreSession(signal)
  if (!refreshed) {
    throw new SessionExpiredError(
      'Your session has expired. Please sign in again.',
    )
  }
  session.access = refreshed.access
}

export async function requestWithSession(
  path: string,
  session: Session,
  {
    signal,
    method = 'get',
    json,
  }: Pick<Options, 'signal' | 'method' | 'json'> = {},
): Promise<Response> {
  async function request(): Promise<Response> {
    try {
      return await ky(path, {
        method,
        json,
        retry: method === 'get' ? 2 : 0,
        credentials: 'omit',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access}` },
        signal,
      })
    } catch (error) {
      if (isHTTPError(error) && error.response.status === 400) {
        const data: Record<string, string | string[]> =
          await error.response.json()
        throw new Error(Object.values(data).flat().join(' '))
      }
      throw error
    }
  }

  try {
    return await request()
  } catch (error) {
    if (!isHTTPError(error) || error.response.status !== 401) throw error
  }

  await refreshAccess(session, signal ?? undefined)
  try {
    return await request()
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) {
      throw new SessionExpiredError(
        'Your session has expired. Please sign in again.',
      )
    }
    throw error
  }
}

export async function getAccount(
  session: Session,
  signal?: AbortSignal,
): Promise<Account> {
  const response = await requestWithSession('/api/users/me/', session, {
    signal,
  })
  return response.json() as Promise<Account>
}

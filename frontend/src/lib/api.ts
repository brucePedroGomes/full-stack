import Cookies from 'js-cookie'
import ky, { isHTTPError, isKyError } from 'ky'
import { z, ZodError } from 'zod'

const sessionSchema = z.object({
  access: z.string().min(1),
})

const accountSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string(),
})

const taskSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  status: z.string(),
  due_date: z.string().nullable(),
})

const taskPageSchema = z.object({
  count: z.number().int(),
  results: z.array(taskSchema),
})

export type Account = z.infer<typeof accountSchema>
export type Task = z.infer<typeof taskSchema>
export type TaskPage = z.infer<typeof taskPageSchema>
export type Session = z.infer<typeof sessionSchema>

export class SessionExpiredError extends Error {}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof SessionExpiredError) return error.message
  if (error instanceof ZodError) return 'The server sent an unexpected response.'
  if (isHTTPError(error)) return 'The server could not finish the request. Please try again.'
  if (isKyError(error)) return 'Cannot reach the server. Please check that Django is running.'
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

async function csrfToken(signal?: AbortSignal): Promise<string> {
  if (!Cookies.get('csrftoken')) {
    await ky.get('/api/auth/browser/csrf/', { credentials: 'same-origin', signal })
  }

  const token = Cookies.get('csrftoken')
  if (!token) throw new Error('Could not start a secure session. Please try again.')
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

export async function signIn(username: string, password: string): Promise<Session> {
  try {
    const response = await browserPost(
      '/api/auth/browser/login/',
      new URLSearchParams({ username, password }),
    )
    const data: unknown = await response.json()
    return sessionSchema.parse(data)
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) {
      throw new Error('The username or password is incorrect.')
    }
    throw error
  }
}

export async function restoreSession(signal?: AbortSignal): Promise<Session | null> {
  try {
    const response = await browserPost('/api/auth/browser/token/', undefined, signal)
    const data: unknown = await response.json()
    return sessionSchema.parse(data)
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) return null
    throw error
  }
}

export async function signOut(): Promise<void> {
  await browserPost('/api/auth/browser/logout/')
}

async function refreshAccess(session: Session, signal?: AbortSignal): Promise<void> {
  const refreshed = await restoreSession(signal)
  if (!refreshed) {
    throw new SessionExpiredError('Your session has expired. Please sign in again.')
  }
  session.access = refreshed.access
}

async function getWithSession(
  path: string,
  session: Session,
  signal?: AbortSignal,
): Promise<unknown> {
  function request(): Promise<unknown> {
    return ky.get(path, {
      credentials: 'omit',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access}` },
      signal,
    }).json<unknown>()
  }

  try {
    return await request()
  } catch (error) {
    if (!isHTTPError(error) || error.response.status !== 401) throw error
  }

  await refreshAccess(session, signal)
  try {
    return await request()
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) {
      throw new SessionExpiredError('Your session has expired. Please sign in again.')
    }
    throw error
  }
}

export async function getAccount(session: Session, signal?: AbortSignal): Promise<Account> {
  const data = await getWithSession('/api/users/me/', session, signal)
  return accountSchema.parse(data)
}

export async function getTasks(session: Session, signal?: AbortSignal): Promise<TaskPage> {
  const data = await getWithSession('/api/tasks/?page_size=5', session, signal)
  return taskPageSchema.parse(data)
}

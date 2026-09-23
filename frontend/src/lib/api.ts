import ky, { isHTTPError, isKyError } from 'ky'
import { z, ZodError } from 'zod'

const sessionSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
})

const refreshSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1).optional(),
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

export async function signIn(username: string, password: string): Promise<Session> {
  try {
    const data = await ky.post('/api/auth/token/', {
      credentials: 'omit',
      json: { username, password },
    }).json<unknown>()
    return sessionSchema.parse(data)
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) {
      throw new Error('The username or password is incorrect.')
    }
    throw error
  }
}

async function refreshAccess(session: Session): Promise<void> {
  let data: unknown
  try {
    data = await ky.post('/api/auth/token/refresh/', {
      credentials: 'omit',
      json: { refresh: session.refresh },
    }).json<unknown>()
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) {
      throw new SessionExpiredError('Your session has expired. Please sign in again.')
    }
    throw error
  }

  const refreshed = refreshSchema.parse(data)
  session.access = refreshed.access
  if (refreshed.refresh) session.refresh = refreshed.refresh
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

  await refreshAccess(session)
  try {
    return await request()
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 401) {
      throw new SessionExpiredError('Your session has expired. Please sign in again.')
    }
    throw error
  }
}

export async function getAccount(session: Session): Promise<Account> {
  const data = await getWithSession('/api/users/me/', session)
  return accountSchema.parse(data)
}

export async function getTasks(session: Session, signal?: AbortSignal): Promise<TaskPage> {
  const data = await getWithSession('/api/tasks/?page_size=5', session, signal)
  return taskPageSchema.parse(data)
}

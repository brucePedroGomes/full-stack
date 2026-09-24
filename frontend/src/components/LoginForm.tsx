import { useState, type SubmitEvent, type ReactElement } from 'react'
import {
  credentialsSchema,
  getApiErrorMessage,
  type Credentials,
} from '@/api/session'
import { Button, Input } from './ui'

type LoginFormProps = {
  onSignIn: (values: Credentials) => void
  pending: boolean
  error: Error | null
  notice: string
}

export function LoginForm({
  onSignIn,
  pending,
  error,
  notice,
}: LoginFormProps): ReactElement {
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof Credentials, string>>
  >({})

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = credentialsSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    )
    if (!result.success) {
      setValidationErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      )
      return
    }
    setValidationErrors({})
    onSignIn(result.data)
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16 text-gray-900">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {notice ? (
        <p role="status" className="mt-4">
          {notice}
        </p>
      ) : null}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Username"
          name="username"
          error={validationErrors.username}
          autoComplete="username"
          autoCapitalize="none"
          required
        />
        <Input
          label="Password"
          name="password"
          error={validationErrors.password}
          type="password"
          autoComplete="current-password"
          required
        />
        {error ? (
          <p role="alert" className="text-red-700">
            {getApiErrorMessage(error)}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending}
        >
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}

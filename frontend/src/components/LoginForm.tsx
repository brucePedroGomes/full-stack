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
  const [validationError, setValidationError] = useState('')

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = credentialsSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    )
    if (!result.success) {
      setValidationError(result.error.issues[0].message)
      return
    }
    setValidationError('')
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
          autoComplete="username"
          autoCapitalize="none"
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {validationError || error ? (
          <p role="alert" className="text-red-700">
            {validationError || getApiErrorMessage(error)}
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

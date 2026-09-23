import { useState, type ReactElement } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/api'

type LoginPageProps = {
  onSignIn: (values: LoginValues) => Promise<void>
  notice: string
}

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
})

export type LoginValues = z.infer<typeof loginSchema>

export function LoginPage({ onSignIn, notice }: LoginPageProps): ReactElement {
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function handleSubmit(values: LoginValues): Promise<void> {
    try {
      await onSignIn(values)
    } catch (signInError) {
      form.setError('root', { message: getApiErrorMessage(signInError) })
    }
  }

  return (
    <div className="grid min-h-svh bg-[#f7f6f2] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <aside className="relative hidden overflow-hidden bg-[#17333b] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -right-56 -top-48 size-[38rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-80 -left-64 size-[42rem] rounded-full border border-white/10" />
        <div className="relative">
          <Brand light />
        </div>

        <div className="relative max-w-xl py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b7d0c6]">
            A calmer way to work
          </p>
          <h2 className="mt-6 font-heading text-5xl leading-[1.07] tracking-tight xl:text-6xl">
            Make space for work that moves forward.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[#c5d6d3]">
            See what matters, keep tasks on track, and move ahead together.
          </p>

          <div className="mt-10 max-w-md rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur-sm" aria-hidden="true">
            <div className="flex items-center justify-between pb-4 text-sm font-medium">
              <span>Today&apos;s flow</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#d9e6e0]">Team view</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-[#17333b] shadow-sm">
                <span className="font-medium">Plan the next step</span>
                <span className="rounded-full bg-[#f7e6cb] px-2.5 py-1 text-xs text-[#77512d]">Planned</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-[#17333b] shadow-sm">
                <span className="font-medium">Share the update</span>
                <span className="rounded-full bg-[#dbe9f3] px-2.5 py-1 text-xs text-[#2d5873]">In progress</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-[#17333b] shadow-sm">
                <span className="font-medium">Review the work</span>
                <span className="rounded-full bg-[#e0eddd] px-2.5 py-1 text-xs text-[#3b6944]">Done</span>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-sm text-[#a9c4bb]">A shared place for steady progress.</p>
      </aside>

      <main className="flex min-h-svh items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-16 lg:hidden">
            <Brand />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#557d70]">
            Your workspace
          </p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-[#17333b] sm:text-5xl">
            Welcome back.
          </h1>
          <p className="mt-4 text-base leading-7 text-[#65736f]">
            Sign in with your team account to see what is moving.
          </p>

          <form className="mt-10 space-y-6" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
            <div className="space-y-2.5">
              <Label htmlFor="username" className="text-sm font-medium text-[#233b40]">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? 'username-error' : undefined}
                {...form.register('username')}
                className="h-12 rounded-xl border-[#d9ded9] bg-white px-4 text-base shadow-none focus-visible:border-[#557d70] focus-visible:ring-[#557d70]/20"
              />
              {errors.username ? <p id="username-error" role="alert" className="text-sm text-[#8b3f31]">{errors.username.message}</p> : null}
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-sm font-medium text-[#233b40]">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...form.register('password')}
                  className="h-12 rounded-xl border-[#d9ded9] bg-white px-4 pr-12 text-base shadow-none focus-visible:border-[#557d70] focus-visible:ring-[#557d70]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-1 grid min-w-11 place-items-center rounded-lg text-[#60716d] hover:text-[#17333b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#557d70]"
                >
                  {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
                </button>
              </div>
              {errors.password ? <p id="password-error" role="alert" className="text-sm text-[#8b3f31]">{errors.password.message}</p> : null}
            </div>

            {notice ? <p role="status" className="rounded-xl bg-[#e6eee8] px-4 py-3 text-sm text-[#345e4b]">{notice}</p> : null}
            {errors.root?.message ? <p role="alert" className="rounded-xl bg-[#f9e7e2] px-4 py-3 text-sm text-[#8b3f31]">{errors.root.message}</p> : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 w-full justify-between rounded-xl bg-[#17333b] px-5 text-base text-white hover:bg-[#274e56]"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
              {isSubmitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-5" aria-hidden="true" />}
            </Button>
          </form>

          <p className="mt-8 border-t border-[#e2e5df] pt-6 text-sm leading-6 text-[#65736f]">
            Need an account? Ask your team administrator.
          </p>
        </div>
      </main>
    </div>
  )
}

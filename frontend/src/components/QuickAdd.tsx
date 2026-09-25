import { useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/api/session'
import type { TaskStatus } from '@/api/tasks'
import { useTaskContext } from '@/contexts/TaskContext'
import { Button, Icon, Input } from './ui'

type QuickAddProps = {
  status: TaskStatus
  label: string
}

export function QuickAdd({ status, label }: QuickAddProps) {
  const { quickAddOptions } = useTaskContext()
  const quickAdd = useMutation(quickAddOptions)
  const [open, setOpen] = useState(false)

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const title = String(new FormData(form).get('title') ?? '').trim()
    if (!title) return
    quickAdd.mutate({ title, status }, { onSuccess: () => form.reset() })
  }

  function closeOnEscape(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') setOpen(false)
  }

  if (!open) {
    return (
      <Button
        variant="plain"
        className="mb-3 w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <Icon name="add" /> Add a card
      </Button>
    )
  }

  return (
    <form className="mb-3 space-y-2" onSubmit={submit} onKeyDown={closeOnEscape}>
      <Input
        aria-label={`Title for a new ${label} card`}
        name="title"
        maxLength={200}
        placeholder="Card title"
        autoFocus
      />
      {quickAdd.error ? (
        <p role="alert" className="text-sm text-red-700">
          {getApiErrorMessage(quickAdd.error)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={quickAdd.isPending}>
          {quickAdd.isPending ? 'Adding...' : 'Add card'}
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}

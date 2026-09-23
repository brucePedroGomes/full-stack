import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import {
  getApiErrorMessage,
  SessionExpiredError,
  type Session,
} from '@/api/session'
import {
  createTask,
  deleteTask,
  taskInputSchema,
  updateTask,
  type Task,
  type TaskInput,
} from '@/api/tasks'
import { UserSelect, type UserSelection } from './UserSelect'

type TaskFormProps = {
  task: Task | null
  session: Session
  onClose: () => void
  onSaved: () => Promise<void>
  onSessionExpired: (message: string) => void
}

export function TaskForm({
  task,
  session,
  onClose,
  onSaved,
  onSessionExpired,
}: TaskFormProps) {
  const [validationError, setValidationError] = useState('')
  const [assignee, setAssignee] = useState<UserSelection>(
    task?.assignee ?? null,
  )
  const save = useMutation({
    mutationFn: (values: TaskInput) =>
      task ? updateTask(session, task.id, values) : createTask(session, values),
    onSuccess: onSaved,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteTask(session, id),
    onSuccess: onSaved,
  })
  const busy = save.isPending || remove.isPending
  const error = save.error || remove.error
  const { mutate: saveTask, reset: resetSave } = save
  const { mutate: removeTask, reset: resetRemove } = remove

  const handleClose = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])
  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const result = taskInputSchema.safeParse({
        ...Object.fromEntries(new FormData(event.currentTarget)),
        assigned_to:
          typeof assignee === 'object' ? (assignee?.id ?? null) : null,
      })
      if (!result.success) {
        setValidationError(result.error.issues[0].message)
        return
      }
      setValidationError('')
      resetRemove()
      saveTask(result.data)
    },
    [assignee, resetRemove, saveTask],
  )
  const handleDelete = useCallback(() => {
    if (task && window.confirm(`Delete "${task.title}"?`)) {
      setValidationError('')
      resetSave()
      removeTask(task.id)
    }
  }, [task, resetSave, removeTask])

  useEffect(() => {
    if (error instanceof SessionExpiredError) onSessionExpired(error.message)
  }, [error, onSessionExpired])

  return (
    <Dialog open onClose={handleClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 w-screen overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-lg rounded-lg bg-white p-6 text-gray-900">
            <DialogTitle className="text-xl font-semibold">
              {task ? 'Edit task' : 'New task'}
            </DialogTitle>
            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <fieldset
                disabled={busy}
                className="min-w-0 space-y-4 disabled:opacity-60"
              >
                <label className="block">
                  Title
                  <input
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={task?.title ?? ''}
                    data-autofocus
                    className="mt-1 min-h-11 w-full rounded border border-gray-300 px-3 focus:outline-2 focus:outline-blue-600"
                  />
                </label>
                <label className="block">
                  Description
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={task?.description ?? ''}
                    className="mt-1 block w-full rounded border border-gray-300 p-3 focus:outline-2 focus:outline-blue-600"
                  />
                </label>
                <label className="block">
                  Due date
                  <input
                    name="due_date"
                    type="date"
                    max="9999-12-31"
                    defaultValue={task?.due_date ?? ''}
                    className="mt-1 min-h-11 w-full min-w-0 rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600"
                  />
                </label>
                <UserSelect
                  label="Assigned to"
                  session={session}
                  value={assignee}
                  onChange={setAssignee}
                  onSessionExpired={onSessionExpired}
                />
              </fieldset>
              {validationError || error ? (
                <p role="alert" className="text-red-700">
                  {validationError || getApiErrorMessage(error)}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4">
                {task ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDelete}
                    className="mr-auto flex min-h-11 items-center gap-2 rounded border border-red-200 px-3 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <TrashIcon aria-hidden="true" className="size-5" />
                    {remove.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleClose}
                  className="min-h-11 rounded border border-gray-300 px-4 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={busy}
                  className="min-h-11 rounded bg-blue-700 px-4 text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {save.isPending ? 'Saving...' : 'Save task'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}

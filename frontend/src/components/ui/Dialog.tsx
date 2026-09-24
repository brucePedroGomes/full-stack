import {
  Description,
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { useCallback, type ReactNode } from 'react'
import { Button } from './controls'

export type DialogProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  closeDisabled?: boolean
  role?: 'dialog' | 'alertdialog'
  children: ReactNode
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  closeDisabled = false,
  role = 'dialog',
  children,
}: DialogProps) {
  const handleClose = useCallback(() => {
    if (!closeDisabled) onClose()
  }, [closeDisabled, onClose])

  return (
    <HeadlessDialog
      open={open}
      onClose={handleClose}
      role={role}
      className="relative z-50 focus:outline-none"
    >
      <DialogBackdrop className="fixed inset-0 bg-gray-950/20" />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 text-gray-900">
            <DialogTitle className="text-base font-medium">{title}</DialogTitle>
            {description ? (
              <Description className="mt-2 text-sm text-gray-500">
                {description}
              </Description>
            ) : null}
            <div className="mt-4">{children}</div>
          </DialogPanel>
        </div>
      </div>
    </HeadlessDialog>
  )
}

export type ConfirmDialogProps = Omit<
  DialogProps,
  'children' | 'role' | 'closeDisabled'
> & {
  confirmLabel: string
  onConfirm: () => void
  pending?: boolean
  error?: string
}

export function ConfirmDialog({
  confirmLabel,
  onConfirm,
  pending = false,
  error,
  ...props
}: ConfirmDialogProps) {
  return (
    <Dialog {...props} role="alertdialog" closeDisabled={pending}>
      {error ? (
        <p role="alert" className="mb-4 text-red-700">{error}</p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button autoFocus onClick={props.onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}

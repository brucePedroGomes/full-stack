import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { ComponentPropsWithRef } from 'react'

const icons = {
  previous: ChevronLeftIcon,
  next: ChevronRightIcon,
  edit: PencilSquareIcon,
  add: PlusIcon,
  delete: TrashIcon,
}

export type IconProps = ComponentPropsWithRef<'svg'> & {
  name: keyof typeof icons
}

export function Icon({ name, className = 'size-5', ...props }: IconProps) {
  const LibraryIcon = icons[name]
  return <LibraryIcon aria-hidden="true" className={className} {...props} />
}

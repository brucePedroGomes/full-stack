import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

type PaginationProps = {
  label: string
  page: number
  hasNext: boolean
  busy: boolean
  onChange: (page: number) => void
}

export function Pagination({
  label,
  page,
  hasNext,
  busy,
  onChange,
}: PaginationProps) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy || page === 1}
        onClick={() => onChange(page - 1)}
        className="flex min-h-11 items-center gap-1 rounded border border-gray-300 bg-white px-3 hover:bg-gray-100 disabled:opacity-50"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" /> Previous
      </button>
      <span>Page {page}</span>
      <button
        type="button"
        disabled={busy || !hasNext}
        onClick={() => onChange(page + 1)}
        className="flex min-h-11 items-center gap-1 rounded border border-gray-300 bg-white px-3 hover:bg-gray-100 disabled:opacity-50"
      >
        Next <ChevronRightIcon aria-hidden="true" className="size-4" />
      </button>
    </nav>
  )
}

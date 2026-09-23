import { Layers2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { cn } from '@/lib/utils'

type BrandProps = {
  light?: boolean
}

export function Brand({ light = false }: BrandProps): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'grid size-10 place-items-center rounded-xl',
          light ? 'bg-white/15 text-white' : 'bg-[#dcebdc] text-[#17333b]',
        )}
        aria-hidden="true"
      >
        <Layers2 className="size-5" />
      </span>
      <span className={cn('text-xl font-semibold tracking-tight', light ? 'text-white' : 'text-[#17333b]')}>
        tempo<span className="text-[#dfab80]">.</span>
      </span>
    </div>
  )
}

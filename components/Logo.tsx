import Link from 'next/link'
import { StarIcon } from '@/components/star-icon'

type LogoProps = {
  /** Overrides default `text-2xl tracking-tight` (e.g. hero: `text-4xl tracking-tight sm:text-5xl`). */
  textClassName?: string
}

export function Logo({ textClassName }: LogoProps) {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center text-foreground hover:opacity-80"
    >
      <span
        style={{ fontFamily: 'Sohne' }}
        className={textClassName ?? 'text-2xl tracking-tight'}
      >
        starmap
      </span>
      <StarIcon className="ml-1.5 shrink-0" />
    </Link>
  )
}

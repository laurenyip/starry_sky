import Link from 'next/link'
import { StarIcon } from '@/components/star-icon'

type LogoMarkProps = {
  textClassName?: string
}

export function LogoMark({ textClassName }: LogoMarkProps) {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center text-foreground hover:opacity-80"
    >
      <span
        style={{ fontFamily: 'Sohne' }}
        className={textClassName ?? 'text-2xl tracking-tight'}
      >
        s
      </span>
      <StarIcon className="ml-1.5 shrink-0" />
    </Link>
  )
}

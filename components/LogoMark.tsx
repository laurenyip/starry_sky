import Link from 'next/link'
import { StarIcon } from '@/components/star-icon'

type LogoMarkProps = {
  textClassName?: string
}

export function LogoMark({ textClassName }: LogoMarkProps) {
  return (
    <Link
      href="/"
      className="inline-flex min-w-0 shrink-0 items-center text-gray-900 hover:opacity-80 dark:text-white"
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

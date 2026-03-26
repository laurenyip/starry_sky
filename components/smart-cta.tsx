'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function SmartCTA({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  const [href, setHref] = useState('/login')

  useEffect(() => {
    const client = createClient()
    void client.auth.getSession().then(({ data: { session } }) => {
      setHref(session ? '/dashboard' : '/login')
    })
  }, [])

  return (
    <Link
      href={href}
      className={
        className ??
        'px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium'
      }
    >
      {label}
    </Link>
  )
}


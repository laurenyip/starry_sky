'use client'

import { LogoMark } from '@/components/LogoMark'
import { ThemeToggle } from '@/components/theme-toggle'
import { useSupabaseContext } from '@/components/supabase-provider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function Navbar() {
  const { supabase, session } = useSupabaseContext()
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    if (!session?.user?.id) {
      setUsername(null)
      setProfileError(null)
      return
    }

    let cancelled = false
    setProfileError(null)

    void supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProfileError(error.message)
          setUsername(null)
          return
        }
        setUsername(data?.username ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [session?.user?.id, supabase])

  async function handleLogout() {
    if (!supabase) return
    setLogoutError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setLogoutError(error.message)
      return
    }
    setUsername(null)
    router.refresh()
    router.push('/')
  }

  const displayName =
    username ?? session?.user.email?.split('@')[0] ?? null

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.07] bg-white/55 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]" data-node-id="64:492">
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <LogoMark />

          <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-xs sm:gap-4 sm:text-sm">
            {session ? (
              <>
                <ThemeToggle />
                {username ? (
                  <Link
                    href={`/profile/${encodeURIComponent(username)}`}
                    className="max-w-[min(12rem,calc(100vw-8rem))] truncate font-medium text-gray-900 underline-offset-4 hover:underline dark:text-white"
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span className="max-w-[min(12rem,calc(100vw-8rem))] truncate text-zinc-600 dark:text-white/90">
                    {displayName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1.5 font-medium text-gray-900 transition-colors hover:bg-zinc-100 sm:px-3 dark:border-white/40 dark:text-white dark:hover:bg-white/10"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link
                  href="/login"
                  className="font-medium text-gray-600 transition-colors hover:text-black dark:text-white dark:hover:text-white/90"
                  data-node-id="64:512"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="shrink-0 rounded-[6px] border border-transparent bg-black px-3 py-1.5 font-medium text-white transition-colors hover:opacity-90 dark:border-white/90 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
                  data-node-id="64:517"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
        {profileError ? (
          <p
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            Couldn&apos;t load profile: {profileError}
          </p>
        ) : null}
        {logoutError ? (
          <p
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {logoutError}
          </p>
        ) : null}
      </div>
    </header>
  )
}

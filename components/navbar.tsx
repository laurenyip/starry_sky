'use client'

import { useSupabaseContext } from '@/components/supabase-provider'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function Navbar() {
  const { supabase, session } = useSupabaseContext()
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      const next: 'light' | 'dark' =
        saved === 'dark' || saved === 'light'
          ? (saved as 'light' | 'dark')
          : prefersDark
            ? 'dark'
            : 'light'
      setTheme(next)
      document.documentElement.classList.toggle('dark', next === 'dark')
    } catch {
      // ignore
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  useEffect(() => {
    if (!supabase) return

    if (!session?.user?.id) {
      setUsername(null)
      setProfileAvatarUrl(null)
      setProfileError(null)
      return
    }

    let cancelled = false
    setProfileError(null)

    void supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProfileError(error.message)
          setUsername(null)
          setProfileAvatarUrl(null)
          return
        }
        setUsername(data?.username ?? null)
        const av = data?.avatar_url
        setProfileAvatarUrl(
          av == null || av === '' ? null : String(av)
        )
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

  const displayName = username ?? session?.user.email?.split('@')[0] ?? null
  const navInitial =
    (username ?? session?.user.email?.split('@')[0] ?? '?')
      .slice(0, 1)
      .toUpperCase()

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-background/80 backdrop-blur-md dark:border-zinc-800/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="shrink-0 text-sm font-semibold tracking-tight text-foreground hover:opacity-80"
          >
            FriendGraph
          </Link>

        <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-xs sm:gap-4 sm:text-sm">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-background/60 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {theme === 'dark' ? (
              // Moon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4.5 w-4.5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0 1 12.003 21C6.477 21 2 16.523 2 11c0-4.556 3.04-8.402 7.221-9.62.35-.102.67.207.586.556A8 8 0 0 0 21.196 14.42c.35-.084.66.236.556.582Z"
                />
              </svg>
            ) : (
              // Sun
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4.5 w-4.5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M6.22 6.22 5.16 5.16M18.84 18.84l-1.06-1.06M17.78 6.22l1.06-1.06M5.16 18.84l1.06-1.06"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                />
              </svg>
            )}
          </button>
          {session ? (
            <>
              <Link
                href="/account"
                className="text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Account
              </Link>
              {username ? (
                <Link
                  href={`/profile/${encodeURIComponent(username)}`}
                  className="flex max-w-[10rem] items-center gap-2 sm:max-w-[14rem]"
                >
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {profileAvatarUrl ? (
                      <Image
                        src={profileAvatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      navInitial
                    )}
                  </span>
                  <span className="truncate font-medium text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100">
                    {displayName}
                  </span>
                </Link>
              ) : (
                <span className="flex max-w-[9rem] items-center gap-2 sm:max-w-[12rem]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {profileAvatarUrl ? (
                      <Image
                        src={profileAvatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      navInitial
                    )}
                  </span>
                  <span className="truncate text-zinc-600 dark:text-zinc-400">
                    {displayName}
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1.5 font-medium text-foreground transition-colors hover:bg-zinc-100 sm:px-3 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="shrink-0 rounded-md bg-foreground px-2.5 py-1.5 font-medium text-background transition-opacity hover:opacity-90 sm:px-3"
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

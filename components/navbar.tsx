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
                  {profileAvatarUrl ? (
                    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-zinc-200 dark:border-zinc-600">
                      <Image
                        src={profileAvatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </span>
                  ) : null}
                  <span className="truncate font-medium text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100">
                    {displayName}
                  </span>
                </Link>
              ) : (
                <span className="max-w-[9rem] truncate text-zinc-600 sm:max-w-[12rem] dark:text-zinc-400">
                  {displayName}
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

'use client'

import { FriendGraphWorkspace } from '@/components/friend-graph/friend-graph-workspace'
import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import { isInvalidRefreshTokenError } from '@/lib/auth/session-errors'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export default function DashboardPage() {
  const { supabase } = useSupabaseContext()
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileOk, setProfileOk] = useState(false)

  const ensureSession = useCallback(async () => {
    if (!supabase) return
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await supabase.auth.signOut({ scope: 'local' })
        setAuthChecked(true)
        router.replace('/login')
        return
      }
      setAuthError(error.message)
      setAuthChecked(true)
      return
    }
    if (!session) {
      setAuthChecked(true)
      router.replace('/login')
      return
    }
    const user = session.user
    const { data: profile, error: perr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (perr) {
      setAuthError(perr.message)
      setAuthChecked(true)
      return
    }
    if (!profile) {
      setUserId(user.id)
      setProfileOk(false)
      setAuthChecked(true)
      return
    }
    setUserId(user.id)
    setProfileOk(true)
    setAuthChecked(true)
    setAuthError(null)
  }, [supabase, router])

  useEffect(() => {
    void ensureSession()
  }, [ensureSession])

  if (!authChecked || !supabase) {
    if (authError) {
      return (
        <div
          className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-12"
          role="alert"
        >
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Couldn&apos;t verify your session.
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {authError}
          </p>
          <button
            type="button"
            onClick={() => globalThis.location.reload()}
            className="mt-6 self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Retry
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <LoadingSpinner className="flex-col gap-3 sm:flex-row" label="Loading…" />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-sm text-zinc-500">
        Redirecting…
      </div>
    )
  }

  if (!profileOk) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-12">
        <h1 className="text-lg font-semibold text-foreground">
          Finish setting up your profile
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your account exists, but we need a profile row before you can add people
          to your graph. This usually happens after email confirmation — create your
          username now.
        </p>
        <Link
          href="/complete-profile"
          className="mt-6 inline-flex justify-center rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
        >
          Complete profile
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-[28rem] w-full min-w-0 flex-col">
      <FriendGraphWorkspace supabase={supabase} userId={userId} />
    </div>
  )
}

'use client'

import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CompleteProfilePage() {
  const { supabase } = useSupabaseContext()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      setUserId(user.id)
      setChecked(true)
      void supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) router.replace('/dashboard')
        })
    })
  }, [supabase, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!supabase || !userId) return
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Username is required.')
      return
    }
    setLoading(true)
    const { error: ins } = await supabase.from('profiles').insert({
      id: userId,
      username: trimmed,
    })
    setLoading(false)
    if (ins) {
      const msg = `${ins.message ?? ''} ${ins.details ?? ''}`.toLowerCase()
      const taken = ins.code === '23505' && msg.includes('username')
      setError(taken ? 'That username is already taken.' : ins.message)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  if (!checked || !supabase) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <LoadingSpinner label="Loading…" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-center text-xl font-semibold tracking-tight text-foreground">
        Complete your profile
      </h1>
      <p className="mt-1 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Pick a username so your graph can link to{' '}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          /profile/you
        </code>
        .
      </p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-8 flex flex-col gap-4"
      >
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            required
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !supabase}
          className="rounded-md bg-foreground py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/login" className="font-medium underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  )
}

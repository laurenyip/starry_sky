'use client'

import { Logo } from '@/components/Logo'
import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignupPage() {
  const { supabase } = useSupabaseContext()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!supabase) {
      setError(
        'App configuration is still loading or Supabase environment variables are missing.'
      )
      return
    }
    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/callback`

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      setError('Please choose a username.')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo } as any,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Could not create account. Try again.')
      setLoading(false)
      return
    }

    if (!data.session) {
      setError(
        'Account created. Confirm your email using the link we sent, then sign in to finish setup. (With confirmations off in Supabase, you are signed in immediately.)'
      )
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      username: trimmedUsername,
    })

    setLoading(false)

    if (profileError) {
      const msg = `${profileError.message ?? ''} ${profileError.details ?? ''}`.toLowerCase()
      const taken = profileError.code === '23505' && msg.includes('username')
      setError(taken ? 'That username is already taken.' : profileError.message)
      return
    }

    router.refresh()
    router.push('/dashboard')
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="flex justify-center">
        <Logo />
      </div>
      <h1 className="mt-8 text-center text-xl font-semibold tracking-tight text-foreground">
        Create an account
      </h1>
      <p className="mt-1 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Join Starmap
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
          <label
            htmlFor="username"
            className="text-sm font-medium text-foreground"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 transition-shadow focus:ring-2 dark:border-zinc-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 transition-shadow focus:ring-2 dark:border-zinc-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 transition-shadow focus:ring-2 dark:border-zinc-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !supabase}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-foreground py-2.5 text-sm font-medium text-background transition-opacity disabled:opacity-60"
        >
          {loading ? (
            <>
              <LoadingSpinner className="[&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-background" />
              Creating account…
            </>
          ) : (
            'Sign up'
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}

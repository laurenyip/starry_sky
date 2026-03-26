'use client'

import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function AccountPage() {
  const { supabase } = useSupabaseContext()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')

  const savedFullNameRef = useRef('')
  const savedUsernameRef = useRef('')

  const [savedFlash, setSavedFlash] = useState<null | 'fullName' | 'username'>(
    null
  )
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<
    null | { kind: 'success' | 'error'; message: string }
  >(null)

  const clearSavedFlashSoon = useCallback(() => {
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    savedFlashTimer.current = setTimeout(() => setSavedFlash(null), 1500)
  }, [])

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    setUserId(user.id)

    // `full_name` may not exist yet; if it doesn't, we’ll still load username.
    const { data: row, error: qerr } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (qerr) {
      const { data: row2, error: qerr2 } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()
      if (qerr2) {
        setLoading(false)
        setPasswordStatus({ kind: 'error', message: qerr2.message })
        return
      }
      const u = String(row2?.username ?? '')
      savedUsernameRef.current = u
      setUsername(u)
      savedFullNameRef.current = ''
      setFullName('')
      setLoading(false)
      return
    }

    if (!row) {
      router.replace('/complete-profile')
      return
    }

    const u = String(row.username ?? '')
    const fn = String(row.full_name ?? '')
    savedUsernameRef.current = u
    savedFullNameRef.current = fn
    setUsername(u)
    setFullName(fn)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const saveFullNameOnBlur = useCallback(async () => {
    if (!supabase || !userId) return
    const next = fullName.trim()
    if (next === savedFullNameRef.current) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: next })
      .eq('id', userId)

    if (error) return
    savedFullNameRef.current = next
    setSavedFlash('fullName')
    clearSavedFlashSoon()
  }, [supabase, userId, fullName, clearSavedFlashSoon])

  const saveUsernameOnBlur = useCallback(async () => {
    if (!supabase || !userId) return
    const next = username.trim()
    if (next === savedUsernameRef.current) return

    setUsernameError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ username: next })
      .eq('id', userId)

    if (error) {
      const msg = error.message?.toLowerCase?.() ?? ''
      const taken =
        error.code === '23505' || msg.includes('duplicate') || msg.includes('username')
      if (taken) {
        setUsernameError('Username already taken')
      } else {
        setUsernameError(error.message)
      }
      setUsername(savedUsernameRef.current)
      return
    }

    savedUsernameRef.current = next
    setSavedFlash('username')
    clearSavedFlashSoon()
  }, [supabase, userId, username, clearSavedFlashSoon])

  const updatePassword = useCallback(async () => {
    if (!supabase || !userId) return
    setPasswordStatus(null)
    const next = password
    const confirm = confirmPassword
    if (!next || !confirm) {
      setPasswordStatus({ kind: 'error', message: 'Please enter a new password.' })
      return
    }
    if (next !== confirm) {
      setPasswordStatus({ kind: 'error', message: 'Passwords do not match.' })
      return
    }

    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) {
      setPasswordStatus({ kind: 'error', message: error.message })
      return
    }
    setPassword('')
    setConfirmPassword('')
    setPasswordStatus({ kind: 'success', message: 'Password updated ✓' })
  }, [supabase, userId, password, confirmPassword])

  if (loading || !supabase) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <LoadingSpinner label="Loading…" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Profile
      </h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="p-4">
          <label className="block text-sm font-medium text-foreground" htmlFor="full-name">
            Full Name
          </label>
          <input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => void saveFullNameOnBlur()}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
          />
          {savedFlash === 'fullName' ? (
            <p className="mt-1 text-xs text-zinc-500 transition-opacity duration-500">
              Saved ✓
            </p>
          ) : null}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-700" />

        <div className="p-4">
          <label className="block text-sm font-medium text-foreground" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setUsernameError(null)
            }}
            onBlur={() => void saveUsernameOnBlur()}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
          />
          {usernameError ? (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {usernameError}
            </p>
          ) : null}
          {!usernameError && savedFlash === 'username' ? (
            <p className="mt-1 text-xs text-zinc-500 transition-opacity duration-500">
              Saved ✓
            </p>
          ) : null}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-700" />

        <div className="p-4">
          <div className="text-sm font-medium text-foreground">Change Password</div>

          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-foreground">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => void updatePassword()}
              className="w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-background"
            >
              Update Password
            </button>
          </div>

          {passwordStatus ? (
            <p
              className={`mt-2 text-xs ${
                passwordStatus.kind === 'success'
                  ? 'text-zinc-600 dark:text-zinc-300'
                  : 'text-red-600'
              }`}
              role={passwordStatus.kind === 'error' ? 'alert' : undefined}
            >
              {passwordStatus.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

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

  const [username, setUsername] = useState('')
  const savedUsernameRef = useRef('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSavedFlash, setUsernameSavedFlash] = useState(false)
  const usernameSavedTimer = useRef<number | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<
    null | { kind: 'success' | 'error'; message: string }
  >(null)

  const [connectionCount, setConnectionCount] = useState<number | null>(null)

  const [isPublic, setIsPublic] = useState(true)
  const [publicSaving, setPublicSaving] = useState(false)
  const [publicErr, setPublicErr] = useState<string | null>(null)

  const [publicUrl, setPublicUrl] = useState('')
  const [copyLabel, setCopyLabel] = useState<'Copy' | 'Copied ✓'>('Copy')
  const copyTimer = useRef<number | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    return () => {
      if (usernameSavedTimer.current) clearTimeout(usernameSavedTimer.current)
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const u = username.trim()
    if (!u) {
      setPublicUrl('')
      return
    }
    setPublicUrl(`${window.location.origin}/profile/${encodeURIComponent(u)}`)
  }, [username])

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

    const { data: row, error: qerr } = await supabase
      .from('profiles')
      .select('username, is_public')
      .eq('id', user.id)
      .maybeSingle()

    if (qerr) {
      setLoading(false)
      setPasswordStatus({ kind: 'error', message: qerr.message })
      return
    }

    if (!row) {
      router.replace('/complete-profile')
      return
    }

    const u = String(row.username ?? '')
    savedUsernameRef.current = u
    setUsername(u)
    const pub = (row as { is_public?: boolean | null }).is_public
    setIsPublic(pub !== false)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const loadConnectionCount = useCallback(async () => {
    if (!supabase || !userId) return
    const { count, error } = await supabase
      .from('nodes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('is_self', false)

    if (error) {
      setConnectionCount(null)
      return
    }
    setConnectionCount(count ?? 0)
  }, [supabase, userId])

  useEffect(() => {
    void loadConnectionCount()
  }, [loadConnectionCount])

  const saveUsername = useCallback(async () => {
    if (!supabase || !userId) return
    const next = username.trim()
    if (!next) {
      setUsernameError('Username is required')
      return
    }
    setUsernameError(null)
    if (next === savedUsernameRef.current) {
      setUsernameSavedFlash(true)
      if (usernameSavedTimer.current) clearTimeout(usernameSavedTimer.current)
      usernameSavedTimer.current = window.setTimeout(
        () => setUsernameSavedFlash(false),
        2000,
      )
      return
    }

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
    setUsernameSavedFlash(true)
    if (usernameSavedTimer.current) clearTimeout(usernameSavedTimer.current)
    usernameSavedTimer.current = window.setTimeout(
      () => setUsernameSavedFlash(false),
      2000,
    )
  }, [supabase, userId, username])

  const updatePassword = useCallback(async () => {
    if (!supabase || !userId) return
    setPasswordStatus(null)
    if (!newPassword || !confirmPassword) {
      setPasswordStatus({ kind: 'error', message: 'Please enter and confirm your new password.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ kind: 'error', message: 'Passwords do not match.' })
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordStatus({ kind: 'error', message: error.message })
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordStatus({ kind: 'success', message: 'Password updated ✓' })
  }, [supabase, userId, newPassword, confirmPassword])

  const copyPublicUrl = useCallback(async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopyLabel('Copied ✓')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopyLabel('Copy'), 2000)
    } catch {
      setPublicErr('Could not copy to clipboard.')
    }
  }, [publicUrl])

  const togglePublic = useCallback(
    async (next: boolean) => {
      if (!supabase || !userId) return
      setPublicErr(null)
      setPublicSaving(true)
      const { error } = await supabase
        .from('profiles')
        .update({ is_public: next })
        .eq('id', userId)
      setPublicSaving(false)
      if (error) {
        setPublicErr(error.message)
        return
      }
      setIsPublic(next)
    },
    [supabase, userId],
  )

  const confirmDeleteAccount = useCallback(async () => {
    if (!supabase || !userId) return
    const u = username.trim()
    if (deleteConfirmInput !== u) return

    setDeleteError(null)
    setDeleteBusy(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setDeleteBusy(false)
      setDeleteError('Session expired. Please sign in again.')
      return
    }

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    const body = (await res.json().catch(() => ({}))) as { error?: string }

    if (!res.ok) {
      setDeleteBusy(false)
      setDeleteError(body.error ?? 'Could not delete account.')
      return
    }

    await supabase.auth.signOut()
    router.refresh()
    router.push('/')
  }, [supabase, userId, username, deleteConfirmInput, router])

  if (loading || !supabase) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <LoadingSpinner label="Loading…" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Profile</h1>

      {/* Section 1 — Username */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        aria-labelledby="section-username"
      >
        <h2 id="section-username" className="text-sm font-medium text-foreground">
          Username
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="profile-username" className="sr-only">
              Username
            </label>
            <input
              id="profile-username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setUsernameError(null)
              }}
              autoComplete="username"
              className="w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-600"
            />
            {usernameError ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {usernameError}
              </p>
            ) : null}
            {usernameSavedFlash ? (
              <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void saveUsername()}
            className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Save
          </button>
        </div>
      </section>

      {/* Section 2 — Password */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        aria-labelledby="section-password"
      >
        <h2 id="section-password" className="text-sm font-medium text-foreground">
          Change Password
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label htmlFor="new-password" className="text-sm text-gray-600 dark:text-gray-400">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-new-password"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              Confirm new password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void updatePassword()}
          className="mt-4 w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-background sm:w-auto sm:px-6"
        >
          Update password
        </button>
        {passwordStatus ? (
          <p
            className={`mt-2 text-sm ${
              passwordStatus.kind === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
            role={passwordStatus.kind === 'error' ? 'alert' : undefined}
          >
            {passwordStatus.message}
          </p>
        ) : null}
      </section>

      {/* Section 3 — Connections count */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        aria-labelledby="section-connections"
      >
        <h2 id="section-connections" className="text-sm font-medium text-foreground">
          Connections
        </h2>
        <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
          {connectionCount === null ? '—' : connectionCount}
        </p>
        <p className="mt-1 text-sm text-gray-400">people in your map</p>
      </section>

      {/* Section 4 — Share */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        aria-labelledby="section-share"
      >
        <h2 id="section-share" className="text-sm font-medium text-foreground">
          Share Your Graph
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            readOnly
            value={publicUrl}
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-foreground dark:border-zinc-600 dark:bg-zinc-950"
            aria-label="Public profile URL"
          />
          <button
            type="button"
            onClick={() => void copyPublicUrl()}
            disabled={!publicUrl}
            className="shrink-0 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white transition-opacity disabled:opacity-50 dark:bg-white dark:text-gray-900"
          >
            {copyLabel}
          </button>
        </div>
        {publicErr ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {publicErr}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Make graph public</span>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            disabled={publicSaving}
            onClick={() => void togglePublic(!isPublic)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              isPublic ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-600'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                isPublic ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        {!isPublic ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your graph is currently private
          </p>
        ) : null}
      </section>

      {/* Section 5 — Delete */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        aria-labelledby="section-delete"
      >
        <h2 id="section-delete" className="text-sm font-medium text-foreground">
          Delete Account
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This will permanently delete your account, all your nodes, connections, and
          communities. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => {
            setDeleteOpen(true)
            setDeleteConfirmInput('')
            setDeleteError(null)
          }}
          className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
        >
          Delete my account
        </button>
      </section>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <h3 id="delete-modal-title" className="font-semibold text-foreground">
              Delete account
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Type your username to confirm deletion:
            </p>
            <input
              value={deleteConfirmInput}
              onChange={(e) => {
                setDeleteConfirmInput(e.target.value)
                setDeleteError(null)
              }}
              className="mt-3 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/30 dark:border-zinc-600"
              autoComplete="off"
              placeholder={username}
            />
            {deleteError ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleteBusy ||
                  deleteConfirmInput.trim() !== username.trim() ||
                  !username.trim()
                }
                onClick={() => void confirmDeleteAccount()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

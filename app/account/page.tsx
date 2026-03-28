'use client'

import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import { syncSelfNodeAvatarWithProfile } from '@/lib/sync-profile-avatar'
import Image from 'next/image'
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

  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarFileRef = useRef<HTMLInputElement | null>(null)

  const [savedFlash, setSavedFlash] = useState<
    null | 'fullName' | 'username' | 'avatar'
  >(null)
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<
    null | { kind: 'success' | 'error'; message: string }
  >(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const clearSavedFlashSoon = useCallback(() => {
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    savedFlashTimer.current = setTimeout(() => setSavedFlash(null), 1500)
  }, [])

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    }
  }, [])

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

  const handleLogout = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) return
    router.refresh()
    router.push('/')
  }, [supabase, router])

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
      .select('username, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (qerr) {
      const { data: row2, error: qerr2 } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      if (qerr2) {
        setLoading(false)
        setPasswordStatus({ kind: 'error', message: qerr2.message })
        return
      }
      const u = String(row2?.username ?? '')
      const av = row2?.avatar_url
      savedUsernameRef.current = u
      setUsername(u)
      savedFullNameRef.current = ''
      setFullName('')
      setProfileAvatarUrl(
        av == null || av === '' ? null : String(av)
      )
      setLoading(false)
      return
    }

    if (!row) {
      router.replace('/complete-profile')
      return
    }

    const u = String(row.username ?? '')
    const fn = String(row.full_name ?? '')
    const av = row.avatar_url
    savedUsernameRef.current = u
    savedFullNameRef.current = fn
    setUsername(u)
    setFullName(fn)
    setProfileAvatarUrl(
      av == null || av === '' ? null : String(av)
    )
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

  const uploadProfileAvatar = useCallback(
    async (file: File) => {
      if (!supabase || !userId) return
      setAvatarError(null)
      setAvatarUploading(true)
      const allowed = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(file.type)) {
        setAvatarError('Please use a JPEG, PNG, or WebP image.')
        setAvatarUploading(false)
        return
      }
      const ext = file.name.includes('.')
        ? (file.name.split('.').pop() ?? 'jpg')
        : 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: false })
      if (upErr) {
        setAvatarError(upErr.message)
        setAvatarUploading(false)
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)
      if (pErr) {
        setAvatarError(pErr.message)
        setAvatarUploading(false)
        return
      }
      const { error: syncErr } = await syncSelfNodeAvatarWithProfile(
        supabase,
        userId,
        publicUrl
      )
      if (syncErr) {
        setAvatarError(syncErr.message)
        setAvatarUploading(false)
        return
      }
      setProfileAvatarUrl(publicUrl)
      setSavedFlash('avatar')
      clearSavedFlashSoon()
      setAvatarUploading(false)
    },
    [supabase, userId, clearSavedFlashSoon]
  )

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
          <p className="text-sm font-medium text-foreground">Profile photo</p>
          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-200/80 dark:border-zinc-600 dark:bg-zinc-700">
              {avatarUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <span
                    className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent dark:border-zinc-500"
                    aria-hidden
                  />
                </div>
              ) : null}
              {profileAvatarUrl ? (
                <Image
                  src={profileAvatarUrl}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-600 dark:text-zinc-300">
                  {(username || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-1 sm:items-start">
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarFileRef.current?.click()}
                className="rounded-md border border-zinc-300 bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Change Photo
              </button>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={avatarUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void uploadProfileAvatar(f)
                }}
              />
              {savedFlash === 'avatar' ? (
                <p className="text-xs text-zinc-500">Saved ✓</p>
              ) : null}
              {avatarError ? (
                <p className="text-xs text-red-600" role="alert">
                  {avatarError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-700" />

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

      <div className="mt-10 flex flex-col items-center gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-700">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-background/60 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {theme === 'dark' ? (
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
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-xs text-zinc-500 underline-offset-2 transition-colors hover:text-foreground hover:underline dark:text-zinc-400"
        >
          Log out
        </button>
      </div>
    </div>
  )
}

'use client'

import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import { useToast } from '@/components/toast-provider'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'] as const

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export default function AccountPage() {
  const { supabase } = useSupabaseContext()
  const { showToast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [editUsername, setEditUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!supabase) return
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
      .select('username, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    if (qerr) {
      setError(qerr.message)
      setLoading(false)
      return
    }
    if (!row) {
      router.replace('/complete-profile')
      return
    }
    const u = String(row.username ?? '')
    const av =
      row.avatar_url == null || row.avatar_url === ''
        ? null
        : String(row.avatar_url)
    setUsername(u)
    setAvatarUrl(av)
    setEditUsername(u)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  function startEdit() {
    setEditMode(true)
    setEditUsername(username)
    setPassword('')
    setConfirmPassword('')
    setAvatarFile(null)
    setError(null)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditUsername(username)
    setPassword('')
    setConfirmPassword('')
    setAvatarFile(null)
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !userId) return
    setError(null)
    setSaving(true)

    const trimmed = editUsername.trim()
    if (!trimmed) {
      setError('Username is required.')
      setSaving(false)
      return
    }

    if (password || confirmPassword) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        setSaving(false)
        return
      }
      if (password !== confirmPassword) {
        setError('Password and confirmation do not match.')
        setSaving(false)
        return
      }
      const { error: pwErr } = await supabase.auth.updateUser({
        password,
      })
      if (pwErr) {
        setError(pwErr.message)
        setSaving(false)
        return
      }
    }

    let nextAvatarUrl = avatarUrl

    if (avatarFile) {
      if (!ALLOWED_IMAGE.includes(avatarFile.type as (typeof ALLOWED_IMAGE)[number])) {
        setError('Please use JPEG, PNG, or WebP for your profile picture.')
        setSaving(false)
        return
      }
      const ext = extFromMime(avatarFile.type)
      const path = `${userId}/profile.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, cacheControl: '3600' })
      if (upErr) {
        setError(upErr.message)
        setSaving(false)
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)
      nextAvatarUrl = publicUrl
    }

    const { error: upProfile } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          username: trimmed,
          avatar_url: nextAvatarUrl,
        },
        { onConflict: 'id' }
      )

    if (upProfile) {
      setError(upProfile.message)
      setSaving(false)
      return
    }

    setUsername(trimmed)
    setAvatarUrl(nextAvatarUrl)
    setEditMode(false)
    setPassword('')
    setConfirmPassword('')
    setAvatarFile(null)
    setSaving(false)
    showToast('Profile saved.', 'success')
    router.refresh()
  }

  async function removeProfilePhoto() {
    if (!supabase || !userId) return
    setSaving(true)
    setError(null)
    const { data: list } = await supabase.storage.from('avatars').list(userId)
    const match = list?.find((o) => o.name.startsWith('profile.'))
    if (match) {
      await supabase.storage.from('avatars').remove([`${userId}/${match.name}`])
    }
    const { error: uerr } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId)
    setSaving(false)
    if (uerr) {
      setError(uerr.message)
      showToast(uerr.message, 'error')
      return
    }
    setAvatarUrl(null)
    setAvatarFile(null)
    setAvatarPreview(null)
    showToast('Profile photo removed.', 'success')
    router.refresh()
  }

  if (loading || !supabase) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <LoadingSpinner label="Loading…" />
      </div>
    )
  }

  const displayAvatar = editMode
    ? avatarPreview ?? avatarUrl
    : avatarUrl

  const initials = username
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Your profile
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Username, password, and profile picture for your account.
      </p>

      {!editMode ? (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
              {displayAvatar ? (
                <Image
                  src={displayAvatar}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-semibold">
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-500">Username</p>
              <p className="truncate text-lg font-semibold">{username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Edit
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleSave(e)}
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

          <div>
            <p className="text-sm font-medium">Profile picture</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="relative flex h-20 w-20 cursor-pointer overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                {displayAvatar ? (
                  <Image
                    src={displayAvatar}
                    alt=""
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-semibold">
                    {initials}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    setAvatarFile(f ?? null)
                  }}
                />
              </label>
              {avatarUrl || avatarPreview ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void removeProfilePhoto()}
                  className="text-sm text-red-600 underline dark:text-red-400"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="acc-username" className="text-sm font-medium">
              Username
            </label>
            <input
              id="acc-username"
              autoComplete="username"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="acc-password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="acc-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="acc-confirm" className="text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="acc-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-foreground py-2.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-md border border-zinc-300 px-4 py-2.5 text-sm dark:border-zinc-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <p className="mt-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href="/dashboard"
          className="font-medium underline-offset-4 hover:underline"
        >
          Back to graph
        </Link>
      </p>
    </div>
  )
}

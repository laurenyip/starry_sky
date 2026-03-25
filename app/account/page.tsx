'use client'

import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import { useToast } from '@/components/toast-provider'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

function extFromFile(file: File): string {
  const mime = file.type
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  const n = file.name.split('.').pop()
  if (n && /^[a-zA-Z0-9]+$/.test(n)) return n.toLowerCase().slice(0, 8)
  return 'jpg'
}

/** Profile avatars use numeric timestamp filenames; node avatars use UUIDs. */
function isProfileAvatarObjectName(name: string): boolean {
  return /^\d+\.(jpg|jpeg|png|webp)$/i.test(name) || name.startsWith('profile.')
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

  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

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

  async function uploadAndSaveAvatar(file: File) {
    if (!supabase || !userId) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      showToast('Please choose an image file.', 'error')
      return
    }

    setPhotoUploading(true)
    setPhotoError(null)
    setError(null)

    const ext = extFromFile(file)
    const path = `${userId}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (upErr) {
      console.error('[account] storage upload failed', upErr)
      setPhotoError(upErr.message)
      showToast(upErr.message, 'error')
      setPhotoUploading(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path)

    const { data: updated, error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)
      .select('avatar_url')
      .maybeSingle()

    if (dbErr) {
      console.error('[account] profiles.avatar_url update failed after upload', dbErr)
      setPhotoError(
        `Photo uploaded but saving your link failed: ${dbErr.message}`
      )
      showToast(dbErr.message, 'error')
      setPhotoUploading(false)
      return
    }

    const saved =
      updated?.avatar_url == null || updated.avatar_url === ''
        ? null
        : String(updated.avatar_url)
    setAvatarUrl(saved ?? publicUrl)
    setPhotoUploading(false)
    showToast('Profile photo saved.', 'success')
    router.refresh()
  }

  function startEdit() {
    setEditMode(true)
    setEditUsername(username)
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setPhotoError(null)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditUsername(username)
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setPhotoError(null)
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

    const { error: upProfile } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', userId)

    if (upProfile) {
      setError(upProfile.message)
      setSaving(false)
      return
    }

    setUsername(trimmed)
    setEditMode(false)
    setPassword('')
    setConfirmPassword('')
    setSaving(false)
    showToast('Profile saved.', 'success')
    router.refresh()
  }

  async function removeProfilePhoto() {
    if (!supabase || !userId) return
    setPhotoUploading(true)
    setPhotoError(null)
    setError(null)

    const { data: list } = await supabase.storage.from('avatars').list(userId)
    for (const o of list ?? []) {
      if (isProfileAvatarObjectName(o.name)) {
        await supabase.storage
          .from('avatars')
          .remove([`${userId}/${o.name}`])
      }
    }

    const { error: uerr } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId)

    setPhotoUploading(false)

    if (uerr) {
      console.error('[account] remove avatar failed', uerr)
      setPhotoError(uerr.message)
      showToast(uerr.message, 'error')
      return
    }

    setAvatarUrl(null)
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

  const displayAvatar = avatarUrl
  const initialsFrom = editMode ? editUsername || username : username
  const initials =
    initialsFrom
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

      <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <p className="text-sm font-medium">Profile photo</p>
        <p className="mt-1 text-xs text-zinc-500">
          Saved to your account as soon as you choose a photo.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
            {displayAvatar ? (
              <Image
                src={displayAvatar}
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-600 dark:text-zinc-300">
                {initials}
              </span>
            )}
            {photoUploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <LoadingSpinner className="flex-col gap-1" label="Uploading…" />
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              id="account-avatar-input"
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={photoUploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void uploadAndSaveAvatar(f)
              }}
            />
            <button
              type="button"
              disabled={photoUploading}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              onClick={() =>
                document.getElementById('account-avatar-input')?.click()
              }
            >
              Change photo
            </button>
            {avatarUrl ? (
              <button
                type="button"
                disabled={photoUploading}
                className="text-left text-sm text-red-600 underline disabled:opacity-50 dark:text-red-400"
                onClick={() => void removeProfilePhoto()}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        {photoError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {photoError}
          </p>
        ) : null}
      </section>

      {!editMode ? (
        <div className="mt-8 space-y-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-500">Username</p>
            <p className="truncate text-lg font-semibold">{username}</p>
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Edit username &amp; password
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
              disabled={saving || photoUploading}
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

'use client'

import { useToast } from '@/components/toast-provider'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

type ProfileRow = {
  id: string
  username: string
  avatar_url: string | null
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const params = useParams<{ username: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [notFoundState, setNotFoundState] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const authUser = session?.user
      if (!authUser) {
        if (!active) return
        setNotFoundState(true)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id,username,avatar_url')
        .eq('id', authUser.id)
        .maybeSingle()

      if (!active) return
      if (error || !data) {
        setErrorMessage(error?.message ?? 'Profile not found')
        setNotFoundState(true)
        setLoading(false)
        return
      }

      const profile = data as ProfileRow
      const routeUsername = decodeURIComponent(params.username)
      if (profile.username !== routeUsername) {
        setNotFoundState(true)
        setLoading(false)
        return
      }

      setUserId(profile.id)
      setUsername(profile.username)
      setEditUsername(profile.username)
      setAvatarUrl(profile.avatar_url)
      setNotFoundState(false)
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [params.username, supabase])

  const onAvatarPicked = async (file: File) => {
    if (!userId) return
    setErrorMessage(null)

    const path = `profile/${userId}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
    if (uploadError) {
      setErrorMessage(uploadError.message)
      return
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = `${publicData.publicUrl}?t=${Date.now()}`
    const { error: saveError } = await supabase
      .from('profiles')
      .upsert({ id: userId, avatar_url: publicUrl }, { onConflict: 'id' })
    if (saveError) {
      setErrorMessage(saveError.message)
      return
    }

    setAvatarUrl(publicUrl)
    showToast('Profile photo updated.', 'success')
  }

  const onCancel = () => {
    setEditUsername(username)
    setNewPassword('')
    setConfirmPassword('')
    setErrorMessage(null)
    setEditOpen(false)
  }

  const onSave = async () => {
    if (!userId) return
    setSaving(true)
    setErrorMessage(null)

    try {
      const trimmedUsername = editUsername.trim()
      if (!trimmedUsername) {
        setErrorMessage('Username is required.')
        return
      }

      if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
          setErrorMessage('Passwords do not match.')
          return
        }
      }

      const { error: usernameError } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, username: trimmedUsername, avatar_url: avatarUrl },
          { onConflict: 'id' }
        )
      if (usernameError) {
        setErrorMessage(usernameError.message)
        return
      }

      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        })
        if (passwordError) {
          setErrorMessage(passwordError.message)
          return
        }
      }

      setUsername(trimmedUsername)
      setEditUsername(trimmedUsername)
      setNewPassword('')
      setConfirmPassword('')
      setEditOpen(false)
      showToast('Profile saved.', 'success')
      router.replace(`/profile/${encodeURIComponent(trimmedUsername)}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (notFoundState) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-base font-medium text-foreground">Profile not found</p>
      </div>
    )
  }

  const initial = username.slice(0, 1).toUpperCase()

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mx-auto block h-28 w-28 overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
          aria-label="Upload profile photo"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={112}
              height={112}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-zinc-500 dark:text-zinc-300">
              {initial}
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void onAvatarPicked(file)
          }}
        />

        <p className="mt-4 text-xl font-semibold text-foreground">{username}</p>

        <button
          type="button"
          onClick={() => setEditOpen((prev) => !prev)}
          className="mt-4 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Edit
        </button>

        {editOpen ? (
          <div className="mt-5 space-y-3 text-left">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Change username
              </label>
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Change password
              </label>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mb-2 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  )
}

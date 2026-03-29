'use client'

import {
  deleteNodePhoto,
  fetchNodePhotos,
  type NodePhotoRow,
  setPhotoAsPrimary,
  uploadNodeGalleryPhoto,
} from '@/lib/node-photo-ops'
import type { SupabaseClient } from '@supabase/supabase-js'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

export function NodePhotoGallery({
  supabase,
  nodeId,
  disabled,
  refreshKey,
  onPrimaryAvatarChange,
  onPhotosCountChange,
}: {
  supabase: SupabaseClient
  nodeId: string
  disabled?: boolean
  /** Increment to reload photos (e.g. after header avatar upload). */
  refreshKey?: number
  onPrimaryAvatarChange: (url: string | null) => void
  /** Fires when gallery photo count changes (for collapsed header labels). */
  onPhotosCountChange?: (count: number) => void
}) {
  const [photos, setPhotos] = useState<NodePhotoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [successFlash, setSuccessFlash] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<NodePhotoRow | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avatarCbRef = useRef(onPrimaryAvatarChange)
  avatarCbRef.current = onPrimaryAvatarChange

  const reload = useCallback(async () => {
    const { data, error: err } = await fetchNodePhotos(supabase, nodeId)
    if (err) {
      console.error('[NodePhotoGallery] reload', err)
      setError(err.message)
      setPhotos([])
      return
    }
    setError(null)
    const rows = data ?? []
    setPhotos(rows)
    const primary = rows.find((p) => p.is_primary)
    avatarCbRef.current(primary?.url ?? null)
  }, [supabase, nodeId])

  useEffect(() => {
    onPhotosCountChange?.(disabled ? 0 : photos.length)
  }, [photos.length, onPhotosCountChange, disabled])

  useEffect(() => {
    if (disabled || !nodeId) {
      setPhotos([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      await reload()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [nodeId, disabled, refreshKey, reload])

  const flashSuccess = (msg: string) => {
    if (successTimer.current) clearTimeout(successTimer.current)
    setSuccessFlash(msg)
    successTimer.current = setTimeout(() => setSuccessFlash(null), 2500)
  }

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || disabled) return

    setError(null)
    setUploadBusy(true)
    const result = await uploadNodeGalleryPhoto(supabase, nodeId, file)
    setUploadBusy(false)

    if (!result.ok) {
      setError(result.message)
      return
    }
    await reload()
    flashSuccess('Photo added ✓')
  }

  const handleSetMain = async (photo: NodePhotoRow) => {
    setError(null)
    setActionBusy(true)
    const result = await setPhotoAsPrimary(supabase, nodeId, photo.id, photo.url)
    setActionBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    await reload()
    setLightbox(null)
  }

  const handleDelete = async (photo: NodePhotoRow) => {
    setError(null)
    setActionBusy(true)
    const result = await deleteNodePhoto(supabase, nodeId, photo, photos)
    setActionBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    await reload()
    setLightbox(null)
  }

  if (disabled) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Save this person to add photos.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {successFlash ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{successFlash}</p>
      ) : null}

      <div className="flex max-h-14 gap-1.5 overflow-x-auto overflow-y-hidden py-0.5">
        {loading ? (
          <span className="text-xs text-zinc-500">Loading photos…</span>
        ) : (
          <>
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
                onClick={() => setLightbox(photo)}
              >
                <Image
                  src={photo.url}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  unoptimized
                />
                {photo.is_primary ? (
                  <span
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-[11px] text-amber-300"
                    aria-label="Main photo"
                  >
                    ★
                  </span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              disabled={uploadBusy}
              className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-300 text-[10px] font-medium leading-tight text-zinc-600 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-400"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadBusy ? (
                <span
                  className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent dark:border-zinc-500"
                  aria-hidden
                />
              ) : (
                '+ Add Photo'
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePickFile(e)}
            />
          </>
        )}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="presentation"
          onClick={() => !actionBusy && setLightbox(null)}
        >
          <div
            className="max-w-[min(90vw,42rem)]"
            role="dialog"
            aria-modal="true"
            aria-label="Photo"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.url}
              alt=""
              width={1200}
              height={1200}
              className="max-h-[70vh] w-auto rounded-lg object-contain"
              unoptimized
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionBusy || lightbox.is_primary}
                className="rounded-md bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
                onClick={() => void handleSetMain(lightbox)}
              >
                Set as Main
              </button>
              <button
                type="button"
                disabled={actionBusy}
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
                onClick={() => void handleDelete(lightbox)}
              >
                Delete
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-zinc-400">
              Click outside to close
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

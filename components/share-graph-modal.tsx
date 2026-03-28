'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

type ShareGraphModalProps = {
  open: boolean
  onClose: () => void
  supabase: SupabaseClient
  userId: string
  username: string
  initialIsPublic: boolean
  onIsPublicChange?: (value: boolean) => void
}

export function ShareGraphModal({
  open,
  onClose,
  supabase,
  userId,
  username,
  initialIsPublic,
  onIsPublicChange,
}: ShareGraphModalProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [savingPublic, setSavingPublic] = useState(false)
  const [publicErr, setPublicErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setIsPublic(initialIsPublic)
      setPublicErr(null)
      setCopied(false)
    }
  }, [open, initialIsPublic])

  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/profile/${encodeURIComponent(username)}`
      : `/profile/${encodeURIComponent(username)}`

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setPublicErr('Could not copy to clipboard.')
    }
  }, [publicUrl])

  const togglePublic = useCallback(
    async (next: boolean) => {
      setPublicErr(null)
      setSavingPublic(true)
      const { error } = await supabase
        .from('profiles')
        .update({ is_public: next })
        .eq('id', userId)
      setSavingPublic(false)
      if (error) {
        setPublicErr(error.message)
        return
      }
      setIsPublic(next)
      onIsPublicChange?.(next)
    },
    [supabase, userId, onIsPublicChange]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-graph-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-background p-5 shadow-lg dark:border-zinc-700">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="share-graph-title"
            className="text-lg font-semibold text-foreground"
          >
            Share your graph
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={publicUrl}
            className="min-w-0 flex-1 cursor-default rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-foreground dark:border-zinc-600 dark:bg-zinc-900 sm:text-sm"
          />
          <button
            type="button"
            onClick={() => void copyLink()}
            className="shrink-0 cursor-pointer rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm font-medium text-foreground transition-transform hover:scale-105 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {copied ? 'Copied ✓' : 'Copy Link'}
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Anyone with this link can view your graph in read-only mode.
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
          <span className="text-sm font-medium text-foreground">
            Make graph public
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            disabled={savingPublic}
            onClick={() => void togglePublic(!isPublic)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50 ${
              isPublic ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {publicErr ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {publicErr}
          </p>
        ) : null}
      </div>
    </div>
  )
}

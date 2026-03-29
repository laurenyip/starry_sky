'use client'

import { useToast } from '@/components/toast-provider'
import { NO_COMMUNITY_KEY } from '@/lib/edge-highlight'
import { DEFAULT_EDGE_NEUTRAL } from '@/lib/flow-build'
import { useCallback, useEffect, useId, useState } from 'react'

export type CommunityRow = { id: string; name: string; color: string }
export type LocationLegendRow = { id: string; name: string; count: number }

export function CommunitiesLegend({
  communities,
  activeCommunityKey,
  activeLocationId,
  locations,
  onPickCommunity,
  onPickLocation,
  onEditCommunity,
  onHoverCommunity,
  onNewCommunity,
}: {
  communities: CommunityRow[]
  activeCommunityKey: string | null
  activeLocationId: string | null
  locations: LocationLegendRow[]
  onPickCommunity: (key: string) => void
  onPickLocation: (locationId: string) => void
  onEditCommunity: (community: CommunityRow) => void
  onHoverCommunity?: (key: string | null) => void
  onNewCommunity: () => void
}) {
  const { showToast } = useToast()
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [locationDraft, setLocationDraft] = useState('')
  const locationTitleId = useId()

  const closeLocationModal = useCallback(() => {
    setLocationModalOpen(false)
    setLocationDraft('')
  }, [])

  useEffect(() => {
    if (!locationModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLocationModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locationModalOpen, closeLocationModal])

  const submitNewLocationHint = useCallback(() => {
    const v = locationDraft.trim()
    if (!v) {
      showToast('Enter a location name.', 'error')
      return
    }
    closeLocationModal()
    showToast(
      `Go to any person's profile and set their location to '${v}' to add them here.`,
      'info',
      4000
    )
  }, [locationDraft, showToast, closeLocationModal])

  return (
    <div className="pointer-events-auto z-20 flex w-full min-w-0 flex-col rounded-xl border border-zinc-200/90 bg-background/95 p-3 shadow-lg backdrop-blur-md dark:border-zinc-700/90">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Communities
      </p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        <li>
          <button
            type="button"
            onClick={() => onPickCommunity(NO_COMMUNITY_KEY)}
            onMouseEnter={() => onHoverCommunity?.(NO_COMMUNITY_KEY)}
            onMouseLeave={() => onHoverCommunity?.(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
              activeCommunityKey === NO_COMMUNITY_KEY
                ? 'bg-zinc-200/80 dark:bg-zinc-700/80'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span
              className="h-1 w-8 shrink-0 rounded-full"
              style={{ backgroundColor: DEFAULT_EDGE_NEUTRAL }}
            />
            <span className="truncate">General</span>
          </button>
        </li>
        {communities.map((c) => (
          <li key={c.id}>
            <div
              onMouseEnter={() => onHoverCommunity?.(c.id)}
              onMouseLeave={() => onHoverCommunity?.(null)}
              className={`rounded-lg px-2 py-1.5 transition-colors ${
                activeCommunityKey === c.id
                  ? 'bg-zinc-200/80 dark:bg-zinc-700/80'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-1 w-8 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="flex-1 truncate text-sm">{c.name}</span>
                <button
                  type="button"
                  title="View community"
                  className="cursor-pointer rounded px-1 text-xs transition-colors hover:bg-white/10 dark:hover:bg-white/10"
                  onClick={() => onPickCommunity(c.id)}
                >
                  👁
                </button>
                <button
                  type="button"
                  title="Edit community"
                  className="cursor-pointer rounded px-1 text-xs transition-colors hover:bg-white/10 dark:hover:bg-white/10"
                  onClick={() => onEditCommunity(c)}
                >
                  ✏️
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onNewCommunity}
        className="mt-3 w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
      >
        + New community
      </button>
      <button
        type="button"
        onClick={() => setLocationModalOpen(true)}
        className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
      >
        + New Location
      </button>

      <div className="my-3 h-px bg-zinc-200/80 dark:bg-zinc-700/80" />

      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Locations
      </p>
      <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
        {locations.map((loc) => (
          <li key={loc.id}>
            <button
              type="button"
              onClick={() => onPickLocation(loc.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                activeLocationId === loc.id
                  ? 'bg-zinc-200/80 dark:bg-zinc-700/80'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="text-zinc-500">📍</span>
              <span className="flex-1 truncate">{loc.name}</span>
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {loc.count}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {locationModalOpen ? (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close"
            onClick={closeLocationModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={locationTitleId}
            className="relative z-10 w-full max-w-sm rounded-xl border border-zinc-200 bg-background p-4 shadow-xl dark:border-zinc-600"
            onClick={(e) => e.stopPropagation()}
          >
            <p id={locationTitleId} className="text-sm font-medium text-foreground">
              New location
            </p>
            <input
              type="text"
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              placeholder="e.g. Vancouver"
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-400/50 dark:border-zinc-600 dark:focus:ring-zinc-500/40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewLocationHint()
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeLocationModal}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNewLocationHint}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

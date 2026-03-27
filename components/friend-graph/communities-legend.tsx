'use client'

import { NO_COMMUNITY_KEY } from '@/lib/edge-highlight'
import { DEFAULT_EDGE_NEUTRAL } from '@/lib/flow-build'

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
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-20 w-[min(16rem,calc(100%-2rem))] rounded-xl border border-zinc-200/90 bg-background/95 p-3 shadow-lg backdrop-blur-md dark:border-zinc-700/90">
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
    </div>
  )
}

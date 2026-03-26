'use client'

import { NO_COMMUNITY_KEY } from '@/lib/edge-highlight'
import { DEFAULT_EDGE_NEUTRAL } from '@/lib/flow-build'

export type CommunityRow = { id: string; name: string; color: string }

export function CommunitiesLegend({
  communities,
  activeCommunityKey,
  onPickCommunity,
  assignCommunityId,
  onToggleAssignCommunity,
  onNewCommunity,
}: {
  communities: CommunityRow[]
  activeCommunityKey: string | null
  onPickCommunity: (key: string) => void
  assignCommunityId: string | null
  onToggleAssignCommunity: (communityId: string) => void
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
              className={`rounded-lg px-2 py-1.5 transition-colors ${
                activeCommunityKey === c.id
                  ? 'bg-zinc-200/80 dark:bg-zinc-700/80'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              } ${assignCommunityId === c.id ? 'ring-1 ring-zinc-400/70' : ''}`}
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
                  className="rounded px-1 text-xs hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
                  onClick={() => onPickCommunity(c.id)}
                >
                  👁
                </button>
                <button
                  type="button"
                  title="Assign members"
                  className="rounded px-1 text-xs hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
                  onClick={() => onToggleAssignCommunity(c.id)}
                >
                  ✏️
                </button>
              </div>
              {assignCommunityId === c.id ? (
                <p className="mt-1 text-[10px] italic text-zinc-500">
                  Adding members...
                </p>
              ) : null}
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
    </div>
  )
}

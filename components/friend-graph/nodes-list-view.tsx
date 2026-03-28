'use client'

import type { DbPerson } from '@/lib/flow-build'
import Image from 'next/image'

export type ListSortMode = 'az' | 'za' | 'recent'

function initialFromName(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

/** Muted avatar ring/fill from first relationship tag (aligns with panel tag colours). */
function avatarAccentFromTag(tag: string | null | undefined): {
  bg: string
  border: string
  text: string
} {
  const t = (tag ?? '').trim()
  if (t === 'Friend' || t === 'Close Friend')
    return { bg: 'rgba(234, 179, 8, 0.22)', border: '#CA8A04', text: '#FEF08A' }
  if (t === 'Ex-Friend' || t === 'Ex-Partner')
    return { bg: 'rgba(251, 146, 60, 0.2)', border: '#EA580C', text: '#FDBA74' }
  if (t === 'Family')
    return { bg: 'rgba(248, 113, 113, 0.2)', border: '#DC2626', text: '#FECACA' }
  if (t === 'Partner')
    return { bg: 'rgba(244, 114, 182, 0.2)', border: '#DB2777', text: '#FBCFE8' }
  if (t === 'Colleague' || t === 'Mentee')
    return { bg: 'rgba(167, 139, 250, 0.22)', border: '#7C3AED', text: '#DDD6FE' }
  if (t === 'Mentor')
    return { bg: 'rgba(74, 222, 128, 0.2)', border: '#16A34A', text: '#BBF7D0' }
  if (t === 'Acquaintance')
    return { bg: 'rgba(56, 189, 248, 0.2)', border: '#0284C7', text: '#BAE6FD' }
  if (t === 'Neighbour' || t === 'Classmate')
    return { bg: 'rgba(45, 212, 191, 0.2)', border: '#0D9488', text: '#99F6E4' }
  if (t === 'Enemy')
    return { bg: 'rgba(251, 113, 133, 0.2)', border: '#E11D48', text: '#FECDD3' }
  return { bg: 'rgba(161, 161, 170, 0.2)', border: '#71717A', text: '#E4E4E7' }
}

export function NodesListView({
  rows,
  totalNonSelfCount,
  searchQuery,
  onSearchChange,
  onSelectPerson,
  sort,
  onSortChange,
  tagsByPersonId,
  tagPillClassName,
}: {
  rows: DbPerson[]
  totalNonSelfCount: number
  searchQuery: string
  onSearchChange: (q: string) => void
  onSelectPerson: (person: DbPerson) => void
  sort: ListSortMode
  onSortChange: (s: ListSortMode) => void
  tagsByPersonId: Map<string, string[]>
  tagPillClassName: (tag: string) => string
}) {
  const q = searchQuery.trim()
  const showNoMatch = q.length > 0 && rows.length === 0 && totalNonSelfCount > 0
  const showEmpty = totalNonSelfCount === 0

  const sortBtn = (mode: ListSortMode, label: string) => {
    const active = sort === mode
    return (
      <button
        type="button"
        onClick={() => onSortChange(mode)}
        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
          active
            ? 'bg-white/10 text-white'
            : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#0a0a0f]">
      <div className="shrink-0 border-b border-gray-800 px-4 pt-3 pb-2">
        <p className="text-xs text-gray-500">
          {rows.length} {rows.length === 1 ? 'person' : 'people'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {sortBtn('az', 'A→Z')}
          {sortBtn('za', 'Z→A')}
          {sortBtn('recent', 'Recently added')}
        </div>
      </div>
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search people..."
        autoComplete="off"
        className="w-full border-b border-gray-800 bg-transparent px-4 py-2.5 text-sm text-white outline-none placeholder-gray-500"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showEmpty ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="text-3xl text-gray-600" aria-hidden>
              ✦
            </span>
            <p className="text-sm text-gray-400">No people yet</p>
            <p className="max-w-xs text-xs text-gray-600">
              Add someone in Graph view to get started
            </p>
          </div>
        ) : showNoMatch ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            No results for &apos;{q}&apos;
          </p>
        ) : (
          <ul className="min-h-0">
            {rows.map((person) => {
              const tags = tagsByPersonId.get(person.id) ?? []
              const showTags = tags.slice(0, 2)
              const more = tags.length - showTags.length
              const accent = avatarAccentFromTag(tags[0] ?? null)
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPerson(person)}
                    className="flex w-full cursor-pointer items-center gap-3 border-b border-gray-800/60 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <span
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-xs font-semibold ${
                        person.avatar_url
                          ? 'border-white/15'
                          : ''
                      }`}
                      style={
                        person.avatar_url
                          ? undefined
                          : {
                              backgroundColor: accent.bg,
                              borderColor: accent.border,
                              color: accent.text,
                            }
                      }
                    >
                      {person.avatar_url ? (
                        <Image
                          src={person.avatar_url}
                          alt=""
                          width={36}
                          height={36}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        initialFromName(person.name)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-white">
                        {person.name}
                      </p>
                      {showTags.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {showTags.map((tag) => (
                            <span
                              key={tag}
                              className={tagPillClassName(tag)}
                            >
                              {tag}
                            </span>
                          ))}
                          {more > 0 ? (
                            <span className="text-[11px] text-gray-500">
                              +{more} more
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-lg text-gray-600" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

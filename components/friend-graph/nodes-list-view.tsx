'use client'

import type { DbPerson } from '@/lib/flow-build'
import Image from 'next/image'
import { useSyncExternalStore } from 'react'

export type ListSortMode = 'az' | 'za' | 'recent'

function subscribeHtmlClass(callback: () => void) {
  const el = document.documentElement
  const mo = new MutationObserver(callback)
  mo.observe(el, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

function getHtmlIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function useHtmlIsDark(): boolean {
  return useSyncExternalStore(
    subscribeHtmlClass,
    getHtmlIsDark,
    () => false
  )
}

function initialFromName(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

type AccentRgb = {
  r: number
  g: number
  b: number
  border: string
  textLight: string
  textDark: string
}

const ACCENT_BY_TAG: AccentRgb[] = [
  { r: 234, g: 179, b: 8, border: '#CA8A04', textLight: '#A16207', textDark: '#FEF08A' },
  { r: 251, g: 146, b: 60, border: '#EA580C', textLight: '#C2410C', textDark: '#FDBA74' },
  { r: 248, g: 113, b: 113, border: '#DC2626', textLight: '#B91C1C', textDark: '#FECACA' },
  { r: 244, g: 114, b: 182, border: '#DB2777', textLight: '#BE185D', textDark: '#FBCFE8' },
  { r: 167, g: 139, b: 250, border: '#7C3AED', textLight: '#5B21B6', textDark: '#DDD6FE' },
  { r: 74, g: 222, b: 128, border: '#16A34A', textLight: '#15803D', textDark: '#BBF7D0' },
  { r: 56, g: 189, b: 248, border: '#0284C7', textLight: '#0369A1', textDark: '#BAE6FD' },
  { r: 45, g: 212, b: 191, border: '#0D9488', textLight: '#0F766E', textDark: '#99F6E4' },
  { r: 251, g: 113, b: 133, border: '#E11D48', textLight: '#BE123C', textDark: '#FECDD3' },
]

const ACCENT_DEFAULT: AccentRgb = {
  r: 113,
  g: 113,
  b: 122,
  border: '#71717A',
  textLight: '#3F3F46',
  textDark: '#E4E4E7',
}

function accentRgbForTag(tag: string | null | undefined): AccentRgb {
  const t = (tag ?? '').trim()
  if (t === 'Friend' || t === 'Close Friend') return ACCENT_BY_TAG[0]!
  if (t === 'Ex-Friend' || t === 'Ex-Partner') return ACCENT_BY_TAG[1]!
  if (t === 'Family') return ACCENT_BY_TAG[2]!
  if (t === 'Partner') return ACCENT_BY_TAG[3]!
  if (t === 'Colleague' || t === 'Mentee') return ACCENT_BY_TAG[4]!
  if (t === 'Mentor') return ACCENT_BY_TAG[5]!
  if (t === 'Acquaintance') return ACCENT_BY_TAG[6]!
  if (t === 'Neighbour' || t === 'Classmate') return ACCENT_BY_TAG[7]!
  if (t === 'Enemy') return ACCENT_BY_TAG[8]!
  return ACCENT_DEFAULT
}

/** Relation colours: light = 0.15 bg opacity, dark = 0.25; text/border full opacity. */
function avatarStylesFromTag(
  tag: string | null | undefined,
  isDark: boolean
): { backgroundColor: string; borderColor: string; color: string } {
  const { r, g, b, border, textLight, textDark } = accentRgbForTag(tag)
  const a = isDark ? 0.25 : 0.15
  return {
    backgroundColor: `rgba(${r},${g},${b},${a})`,
    borderColor: border,
    color: isDark ? textDark : textLight,
  }
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
  const isDark = useHtmlIsDark()
  const q = searchQuery.trim()
  const showNoMatch = q.length > 0 && rows.length === 0 && totalNonSelfCount > 0
  const showEmpty = totalNonSelfCount === 0

  const sortBtn = (mode: ListSortMode, label: string) => {
    const active = sort === mode
    return (
      <button
        type="button"
        onClick={() => onSortChange(mode)}
        className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-150 ease-out ${
          active
            ? 'border-transparent bg-gray-900 text-white dark:border-transparent dark:bg-white dark:text-black'
            : 'border-gray-300 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white transition-colors duration-200 dark:bg-gray-900">
      <div className="shrink-0 border-b border-gray-200 px-4 pt-3 pb-2 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500">
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
        className="w-full border-b border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder-gray-400 dark:border-gray-800 dark:bg-transparent dark:text-white dark:placeholder-gray-500"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showEmpty ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span
              className="text-3xl text-gray-400 dark:text-gray-600"
              aria-hidden
            >
              ✦
            </span>
            <p className="text-sm text-gray-400 dark:text-gray-400">
              No people yet
            </p>
            <p className="max-w-xs text-xs text-gray-500 dark:text-gray-600">
              Add someone in Graph view to get started
            </p>
          </div>
        ) : showNoMatch ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No results for &apos;{q}&apos;
          </p>
        ) : (
          <ul className="min-h-0">
            {rows.map((person) => {
              const tags = tagsByPersonId.get(person.id) ?? []
              const showTags = tags.slice(0, 2)
              const more = tags.length - showTags.length
              const accentStyle = avatarStylesFromTag(tags[0] ?? null, isDark)
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPerson(person)}
                    className="group relative flex w-full origin-left cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-left transition-transform duration-200 ease-out hover:scale-[1.01] dark:border-gray-800/60"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
                      style={{
                        background:
                          'radial-gradient(ellipse at 0% 50%, rgba(167,139,250,0.06) 0%, transparent 70%)',
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-xs font-semibold ${
                          person.avatar_url
                            ? 'border-gray-200 dark:border-white/15'
                            : ''
                        }`}
                        style={
                          person.avatar_url
                            ? undefined
                            : accentStyle
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
                        <p className="break-words text-sm font-medium text-gray-900 dark:text-white">
                          {person.name}
                        </p>
                        {showTags.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {showTags.map((tag) => (
                              <span key={tag} className={tagPillClassName(tag)}>
                                {tag}
                              </span>
                            ))}
                            {more > 0 ? (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                +{more} more
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className="shrink-0 text-lg text-gray-300 transition-colors duration-200 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                        aria-hidden
                      >
                        ›
                      </span>
                    </div>
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

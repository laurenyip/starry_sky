'use client'

import type { DbPerson } from '@/lib/flow-build'
import Image from 'next/image'

function avatarBgColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 13) % 360
  return `hsl(${Math.floor(h)} 55% 42%)`
}

function initialFromName(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

export function NodesListView({
  rows,
  searchQuery,
  onSearchChange,
  onSelectPerson,
}: {
  rows: DbPerson[]
  searchQuery: string
  onSearchChange: (q: string) => void
  onSelectPerson: (person: DbPerson) => void
}) {
  const q = searchQuery.trim()
  const showNoMatch = q.length > 0 && rows.length === 0

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-[#0a0a0f]">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name…"
          autoComplete="off"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-foreground outline-none ring-violet-500/30 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900"
        />
      </div>
      <div className="overflow-y-auto h-full min-h-0 flex-1 bg-white dark:bg-[#0a0a0f]">
        {showNoMatch ? (
          <p className="px-4 py-6 text-center text-sm text-zinc-500">
            No results for &apos;{q}&apos;
          </p>
        ) : (
          <ul className="min-h-0">
            {rows.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onSelectPerson(person)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 text-left dark:border-zinc-800 dark:hover:bg-zinc-900/80"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-200/80 dark:border-zinc-600">
                    {person.avatar_url ? (
                      <Image
                        src={person.avatar_url}
                        alt=""
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                        style={{ backgroundColor: avatarBgColor(person.name) }}
                      >
                        {initialFromName(person.name)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 truncate font-medium text-sm text-foreground">
                    {person.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

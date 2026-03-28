/** Canonical relationship tag list (multi-select). */
export const RELATION_TYPES = [
  'Friend',
  'Close Friend',
  'Ex-Friend',
  'Family',
  'Partner',
  'Ex-Partner',
  'Colleague',
  'Mentor',
  'Mentee',
  'Acquaintance',
  'Neighbour',
  'Classmate',
  'Enemy',
  'Other',
] as const

export function legacyTagToRelationTypeLegacyField(tag: string | null): string | null {
  if (!tag) return null
  return tag.trim().toLowerCase().replace(/\s+/g, '_')
}

export function normalizeRelationTags(tags: string[]): string[] {
  const allowed = new Set<string>(RELATION_TYPES as unknown as string[])
  const cleaned = tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t) => allowed.has(t))
  const uniq = Array.from(new Set(cleaned))
  const order = new Map<string, number>(
    (RELATION_TYPES as unknown as string[]).map((t, i) => [t, i])
  )
  uniq.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
  return uniq
}

export function legacyRelationTypeToTags(rt: string | null | undefined): string[] {
  const t = (rt ?? '').trim().toLowerCase()
  if (!t) return []
  if (t === 'friend') return ['Friend']
  if (t === 'family') return ['Family']
  if (t === 'partner') return ['Partner']
  if (t === 'colleague') return ['Colleague']
  if (t === 'mentor') return ['Mentor']
  if (t === 'mentee') return ['Mentee']
  if (t === 'acquaintance') return ['Acquaintance']
  if (t === 'neighbour') return ['Neighbour']
  if (t === 'classmate') return ['Classmate']
  if (t === 'enemy') return ['Enemy']
  if (t === 'other') return ['Other']
  return ['Other']
}

export function relationTagPillClass(tag: string): string {
  const t = tag.trim()
  const base = 'rounded-full px-2 py-0.5 text-[11px] font-medium border'
  if (t === 'Friend' || t === 'Close Friend')
    return `${base} border-yellow-200 bg-yellow-100 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-200`
  if (t === 'Ex-Friend' || t === 'Ex-Partner')
    return `${base} border-orange-200 bg-orange-100 text-orange-900 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-200`
  if (t === 'Family')
    return `${base} border-red-200 bg-red-100 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200`
  if (t === 'Partner')
    return `${base} border-pink-200 bg-pink-100 text-pink-900 dark:border-pink-900/50 dark:bg-pink-900/20 dark:text-pink-200`
  if (t === 'Colleague' || t === 'Mentee')
    return `${base} border-purple-200 bg-purple-100 text-purple-900 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-200`
  if (t === 'Mentor')
    return `${base} border-green-200 bg-green-100 text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200`
  if (t === 'Acquaintance')
    return `${base} border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-200`
  if (t === 'Neighbour' || t === 'Classmate')
    return `${base} border-teal-200 bg-teal-100 text-teal-900 dark:border-teal-900/50 dark:bg-teal-900/20 dark:text-teal-200`
  if (t === 'Enemy')
    return `${base} border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200`
  return `${base} border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`
}

export function relationTagPickerClass(selected: boolean): string {
  return [
    'rounded-full px-2 py-1 text-xs transition-colors',
    selected
      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
      : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900',
  ].join(' ')
}

export function getDateFieldType(
  key: string
): 'birthday' | 'anniversary' | 'met' | 'upcoming' | null {
  const k = key.toLowerCase().trim()
  if (
    k.includes('birthday') ||
    k.includes('birth date') ||
    k.includes('dob') ||
    k.includes('date of birth')
  )
    return 'birthday'
  if (k.includes('anniversary')) return 'anniversary'
  if (k.includes('met') || k.includes('how we met') || k.includes('first met'))
    return 'met'
  if (
    k.includes('plan') ||
    k.includes('upcoming') ||
    k.includes('event') ||
    k.includes('trip') ||
    k.includes('visit') ||
    k.includes('reminder')
  )
    return 'upcoming'
  return null
}

export function canonicalDate(value: string): {
  canonical: string | null
  parseable: boolean
} {
  const t = value.trim()
  if (!t) return { canonical: null, parseable: true }
  const ymd = /^\d{4}-\d{2}-\d{2}$/
  if (ymd.test(t)) return { canonical: t, parseable: true }
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) return { canonical: null, parseable: false }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return { canonical: `${yyyy}-${mm}-${dd}`, parseable: true }
}

export function formatLongDate(val: string): string {
  if (!val) return ''
  const d = new Date(val + 'T00:00:00')
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function birthdayAge(val: string): number | null {
  if (!val) return null
  const d = new Date(val + 'T00:00:00')
  if (!Number.isFinite(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age >= 0 ? age : null
}

/** Full years from date-of-record to today (anniversary / “known for”). */
export function fullYearsSince(ymd: string): number | null {
  if (!ymd) return null
  const d = new Date(ymd + 'T00:00:00')
  if (!Number.isFinite(d.getTime())) return null
  const now = new Date()
  let y = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) y -= 1
  return y >= 0 ? y : null
}

/** Days until the next calendar occurrence of month/day (0 = today). */
export function daysUntilNextAnnualEvent(ymd: string): number | null {
  const c = canonicalDate(ymd)
  if (!c.canonical) return null
  const [, ms, ds] = c.canonical.split('-').map(Number)
  const now = new Date()
  let target = new Date(now.getFullYear(), ms - 1, ds)
  const today = stripTime(now)
  if (target < today) {
    target = new Date(now.getFullYear() + 1, ms - 1, ds)
  }
  return Math.round(
    (stripTime(target).getTime() - today.getTime()) / 86400000
  )
}

export function isAnnualDateToday(ymd: string): boolean {
  const c = canonicalDate(ymd)
  if (!c.canonical) return false
  const [, m, d] = c.canonical.split('-').map(Number)
  const now = new Date()
  return now.getMonth() + 1 === m && now.getDate() === d
}

export function parseUpcomingValue(
  raw: string
): { date: string; note: string } | null {
  const t = raw.trim()
  if (!t) return { date: '', note: '' }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { date: t, note: '' }
  try {
    const u = JSON.parse(t) as unknown
    if (u && typeof u === 'object' && u !== null && 'date' in u) {
      const o = u as Record<string, unknown>
      return {
        date: String(o.date ?? ''),
        note: String(o.note ?? ''),
      }
    }
  } catch {
    return null
  }
  return null
}

export function serializeUpcoming(date: string, note: string): string {
  const d = date.trim()
  const n = note.trim()
  if (!d && !n) return ''
  return JSON.stringify({ date: d, note: n })
}

export function daysUntilCalendarDate(ymd: string): number | null {
  const c = canonicalDate(ymd)
  if (!c.canonical) return null
  const target = new Date(c.canonical + 'T00:00:00')
  const today = stripTime(new Date())
  return Math.round(
    (stripTime(target).getTime() - today.getTime()) / 86400000
  )
}

export function normalizeAttributeValueForKey(
  key: string,
  value: string
): string {
  const t = getDateFieldType(key)
  if (!t) return value
  if (t === 'upcoming') {
    const p = parseUpcomingValue(value)
    if (p && p.date) {
      const cd = canonicalDate(p.date)
      if (cd.canonical) return serializeUpcoming(cd.canonical, p.note)
    }
    return value
  }
  const c = canonicalDate(value)
  if (!c.parseable || !c.canonical || c.canonical === value.trim()) return value
  return c.canonical
}

export function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

export function sanitizeNullable(s: unknown): string | null {
  if (s == null) return null
  if (typeof s !== 'string') return null
  const t = sanitize(s)
  return t.length ? t : null
}


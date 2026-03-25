/** Plain relative time for UI timelines (no external deps). */
export function formatRelativeTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const ms = d.getTime()
  if (Number.isNaN(ms)) return ''

  const deltaSec = Math.round((Date.now() - ms) / 1000)
  if (deltaSec < 45) return 'just now'
  if (deltaSec < 90) return '1 minute ago'
  const deltaMin = Math.round(deltaSec / 60)
  if (deltaMin < 60)
    return deltaMin === 1 ? '1 minute ago' : `${deltaMin} minutes ago`
  const deltaHr = Math.round(deltaMin / 60)
  if (deltaHr < 24)
    return deltaHr === 1 ? '1 hour ago' : `${deltaHr} hours ago`
  const deltaDay = Math.round(deltaHr / 24)
  if (deltaDay < 30)
    return deltaDay === 1 ? 'yesterday' : `${deltaDay} days ago`
  const deltaMo = Math.round(deltaDay / 30)
  if (deltaMo < 12)
    return deltaMo === 1 ? '1 month ago' : `${deltaMo} months ago`
  const deltaYr = Math.round(deltaDay / 365)
  return deltaYr === 1 ? '1 year ago' : `${deltaYr} years ago`
}

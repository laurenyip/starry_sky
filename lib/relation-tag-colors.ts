import type { CSSProperties } from 'react'

/**
 * Primary hex per relationship tag (text, border tint, background tint).
 * Aligns with semantic colours used in relationTagPillClass / graph styling.
 */
export const TAG_COLORS: Record<string, string> = {
  Friend: '#CA8A04',
  'Close Friend': '#A16207',
  'Ex-Friend': '#EA580C',
  Family: '#DC2626',
  Partner: '#DB2777',
  'Ex-Partner': '#C2410C',
  Colleague: '#9333EA',
  Mentor: '#059669',
  Mentee: '#7C3AED',
  Acquaintance: '#0284C7',
  Neighbour: '#0D9488',
  Classmate: '#14B8A6',
  Enemy: '#E11D48',
  Other: '#71717A',
}

export const TAG_COLOR_FALLBACK = '#94A3B8'

export function relationTagChipStyle(tag: string): CSSProperties {
  const hex = TAG_COLORS[tag] ?? TAG_COLOR_FALLBACK
  return {
    backgroundColor: `${hex}20`,
    color: hex,
    border: `1px solid ${hex}40`,
  }
}

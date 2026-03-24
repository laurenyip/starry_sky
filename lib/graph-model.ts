/** Aligns with Postgres enum `public.node_relationship` */

export const RELATIONSHIP_VALUES = [
  'friend',
  'family',
  'acquaintance',
  'colleague',
  'network',
  'romantic',
  'mentor',
] as const

export type RelationshipKind = (typeof RELATIONSHIP_VALUES)[number]

export function isRelationship(s: string): s is RelationshipKind {
  return (RELATIONSHIP_VALUES as readonly string[]).includes(s)
}

export function normalizeRelationship(s: unknown): RelationshipKind {
  const t = typeof s === 'string' ? s.toLowerCase().trim() : ''
  if (isRelationship(t)) return t
  return 'friend'
}

export function relationshipTitle(s: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function parseCustomAttributes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim()
    if (!key) continue
    if (typeof v === 'string') out[key] = v
    else if (v != null) out[key] = JSON.stringify(v)
  }
  return out
}

export function rowsToCustomAttributes(
  rows: { key: string; value: string }[]
): Record<string, string> {
  const o: Record<string, string> = {}
  for (const r of rows) {
    const k = r.key.trim()
    if (!k) continue
    o[k] = r.value
  }
  return o
}

export function customAttributesToRows(
  m: Record<string, string>
): { key: string; value: string }[] {
  const e = Object.entries(m)
  if (e.length === 0) return [{ key: '', value: '' }]
  return e.map(([key, value]) => ({ key, value }))
}

export const CONSTELLATION_NODE_ID = (locationId: string) => `loc-${locationId}`

export const CONSTELLATION_WIDTH = 360
export const CONSTELLATION_HEIGHT = 300

export function constellationGroupPosition(
  index: number,
  cols = 3,
  gapX = 440,
  gapY = 360,
  originX = 60,
  originY = 40
) {
  const col = index % cols
  const row = Math.floor(index / cols)
  return { x: originX + col * gapX, y: originY + row * gapY }
}

export function scatterPersonInGroup(
  index: number,
  total: number,
  w = CONSTELLATION_WIDTH,
  h = CONSTELLATION_HEIGHT
): { x: number; y: number } {
  const n = Math.max(total, 1)
  const angle = (2 * Math.PI * index) / n - Math.PI / 2
  const r = Math.min(w, h) * 0.28 * (0.85 + ((index * 3) % 5) * 0.04)
  return {
    x: w / 2 + Math.cos(angle) * r,
    y: h / 2 + Math.sin(angle) * r,
  }
}

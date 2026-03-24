import type { DbEdge } from '@/lib/flow-build'

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

/** One canonical edge per unordered pair (deterministic: first by edge id after sort). */
export function dedupeEdgesForGraph(edges: DbEdge[]): DbEdge[] {
  const map = new Map<string, DbEdge>()
  const sorted = [...edges].sort((a, b) => a.id.localeCompare(b.id))
  for (const e of sorted) {
    const key = pairKey(e.source_node_id, e.target_node_id)
    if (!map.has(key)) map.set(key, e)
  }
  return [...map.values()]
}

/** Unique neighbor connections for a person (dedupes A→B and B→A). */
export function edgesForPersonDeduped(
  edges: DbEdge[],
  personId: string
): DbEdge[] {
  const seen = new Set<string>()
  const out: DbEdge[] = []
  for (const e of edges) {
    if (e.source_node_id !== personId && e.target_node_id !== personId) continue
    const other =
      e.source_node_id === personId ? e.target_node_id : e.source_node_id
    const key = pairKey(personId, other)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

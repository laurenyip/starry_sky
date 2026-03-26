import { NO_COMMUNITY_KEY } from '@/lib/edge-highlight'

export type EdgeForCommunity = {
  source_node_id: string
  target_node_id: string
  community_id: string | null
}

function normalizeCommunityId(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length ? t : null
}

/** Each node that appears on at least one edge in this community (raw edges, not deduped). */
export function nodeIdsInCommunity(
  edges: EdgeForCommunity[],
  communityKey: string
): Set<string> {
  const out = new Set<string>()
  const normalizedKey =
    communityKey === NO_COMMUNITY_KEY
      ? NO_COMMUNITY_KEY
      : normalizeCommunityId(communityKey)
  for (const e of edges) {
    const edgeCommunityId = normalizeCommunityId(e.community_id)
    const inCommunity =
      normalizedKey === NO_COMMUNITY_KEY
        ? edgeCommunityId == null
        : edgeCommunityId === normalizedKey
    if (inCommunity) {
      out.add(e.source_node_id)
      out.add(e.target_node_id)
    }
  }
  return out
}

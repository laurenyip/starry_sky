import { NO_COMMUNITY_KEY } from '@/lib/edge-highlight'

export type EdgeForCommunity = {
  source_node_id: string
  target_node_id: string
  community_id: string | null
}

/** Each node that appears on at least one edge in this community (raw edges, not deduped). */
export function nodeIdsInCommunity(
  edges: EdgeForCommunity[],
  communityKey: string
): Set<string> {
  const out = new Set<string>()
  for (const e of edges) {
    const inCommunity =
      communityKey === NO_COMMUNITY_KEY
        ? e.community_id == null || e.community_id === ''
        : e.community_id === communityKey
    if (inCommunity) {
      out.add(e.source_node_id)
      out.add(e.target_node_id)
    }
  }
  return out
}

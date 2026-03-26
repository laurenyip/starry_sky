import type { Edge } from '@xyflow/react'

/** Sentinel for edges with no community (must match flow-build). */
export const NO_COMMUNITY_KEY = '__none__'

export type GraphHighlightState =
  | { kind: 'none' }
  | { kind: 'node'; nodeId: string }

const TRANSITION =
  'stroke 0.28s ease, stroke-width 0.28s ease, opacity 0.28s ease'

const NEUTRAL = '#AAAAAA'

export type CommunityHighlightOpts = {
  /** Legend / edge-driven community focus; `null` = no community highlight. */
  selectedCommunityId: string | null
  /** Hex stroke for edges in the focused community (and for member glow on nodes). */
  selectedCommunityHex: string
}

function baseStrokeOf(e: Edge): string {
  const d = e.data as Record<string, unknown> | undefined
  const b = d?.baseStroke
  return typeof b === 'string' && b.length > 0 ? b : NEUTRAL
}

function communityKeyOf(e: Edge): string {
  const d = e.data as Record<string, unknown> | undefined
  const k = d?.communityKey
  if (typeof k !== 'string') return NO_COMMUNITY_KEY
  const t = k.trim()
  return t.length ? t : NO_COMMUNITY_KEY
}

export function applyGraphEdgeHighlights(
  edges: Edge[],
  state: GraphHighlightState,
  selectedEdgeId: string | null | undefined,
  communityHighlight?: CommunityHighlightOpts | null
): Edge[] {
  return edges.map((e) => {
    const base = baseStrokeOf(e)
    const commKey = communityKeyOf(e)
    const selected = selectedEdgeId === e.id

    let stroke = base
    let strokeWidth = 0.5
    let opacity = 1

    if (communityHighlight?.selectedCommunityId != null) {
      const sid = communityHighlight.selectedCommunityId
      const match = commKey === sid
      if (match) {
        stroke = communityHighlight.selectedCommunityHex
        strokeWidth = 1.5
        opacity = 1
      } else {
        stroke = NEUTRAL
        strokeWidth = 0.5
        opacity = 0.1
      }
    } else if (state.kind === 'node') {
      const incident = e.source === state.nodeId || e.target === state.nodeId
      if (incident) {
        strokeWidth = 1.5
        opacity = 1
      } else {
        strokeWidth = 0.5
        opacity = 0.2
      }
    }

    return {
      ...e,
      selected,
      style: {
        ...e.style,
        stroke,
        strokeWidth,
        opacity,
        transition: TRANSITION,
      },
    }
  })
}

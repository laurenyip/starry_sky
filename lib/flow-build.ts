import type { Edge, Node } from '@xyflow/react'
import { NO_COMMUNITY_KEY } from '@/lib/edge-highlight'
import { dedupeEdgesForGraph } from '@/lib/edge-helpers'
import { layoutPersonNodesInCluster } from '@/lib/force-layout-cluster'
import { relationTypeToBorderColor } from '@/lib/relation-type-colors'
import { scatterPersonInGroup } from '@/lib/graph-model'

export type DbLocation = { id: string; name: string; user_id?: string }
export type DbPerson = {
  id: string
  name: string
  location_id: string | null
  relationship: string
  things_to_remember: string
  custom_attributes: Record<string, unknown> | null
  position_x: number | null
  position_y: number | null
  /** Manual pin (drag); overrides layout when set. */
  pos_x: number | null
  pos_y: number | null
  avatar_url: string | null
  is_self: boolean
  created_at?: string | null
}
export type DbEdge = {
  id: string
  source_node_id: string
  target_node_id: string
  label: string
  community_id: string | null
  relation_type: string | null
  created_at: string | null
}

export const DEFAULT_EDGE_NEUTRAL = '#AAAAAA'
const NORMAL_NODE_SIZE = 52
const SELF_NODE_SIZE = 84

export type FlowBuildOptions = {
  highlightPersonId?: string | null
  shiftConnect?: boolean
  runForceLayout?: boolean
  /** id -> hex color for edge strokes */
  communityColors?: Map<string, string>
  /** Node id for the signed-in user ("You"); used with edge.relation_type for borders. */
  selfNodeId?: string | null
}

function normalizeCommunityId(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length ? t : null
}

function hasPinnedLocal(p: DbPerson): boolean {
  return (
    p.pos_x != null &&
    p.pos_y != null &&
    Number.isFinite(p.pos_x) &&
    Number.isFinite(p.pos_y)
  )
}

function hasSavedLayout(p: DbPerson): boolean {
  return (
    p.position_x != null &&
    p.position_y != null &&
    Number.isFinite(p.position_x) &&
    Number.isFinite(p.position_y)
  )
}

function buildPositionsForGroup(
  group: DbPerson[],
  locInternal: { source: string; target: string }[],
  runForceLayout: boolean | undefined,
  anchor: { x: number; y: number }
): Map<string, { x: number; y: number }> {
  const pinnedLocal = new Map<string, { x: number; y: number }>()
  for (const p of group) {
    if (hasPinnedLocal(p))
      pinnedLocal.set(p.id, { x: p.pos_x!, y: p.pos_y! })
  }
  const needsForce = Boolean(
    runForceLayout &&
      group.some((p) => !hasPinnedLocal(p) && !hasSavedLayout(p))
  )
  if (needsForce && group.length > 0) {
    const clustered = layoutPersonNodesInCluster(
      group.map((q) => q.id),
      locInternal,
      420,
      320,
      pinnedLocal
    )
    const moved = new Map<string, { x: number; y: number }>()
    for (const [id, pos] of clustered.entries()) {
      moved.set(id, { x: pos.x + anchor.x, y: pos.y + anchor.y })
    }
    return moved
  }
  const positions = new Map<string, { x: number; y: number }>()
  group.forEach((p, i) => {
    if (hasPinnedLocal(p)) {
      positions.set(p.id, { x: p.pos_x!, y: p.pos_y! })
    } else {
      const px = p.position_x
      const py = p.position_y
      if (
        px != null &&
        py != null &&
        Number.isFinite(px) &&
        Number.isFinite(py)
      ) {
        positions.set(p.id, { x: px, y: py })
      } else {
        const rel = scatterPersonInGroup(i, group.length, 240, 220)
        positions.set(p.id, {
          x: anchor.x + rel.x - 120,
          y: anchor.y + rel.y - 110,
        })
      }
    }
  })
  return positions
}

export function buildFlowElements(
  locations: DbLocation[],
  people: DbPerson[],
  edges: DbEdge[],
  options: FlowBuildOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const sortedLocs = [...locations].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  const peopleByLoc = new Map<string, DbPerson[]>()
  for (const p of people) {
    const lid = p.location_id ?? '_none'
    const arr = peopleByLoc.get(lid) ?? []
    arr.push(p)
    peopleByLoc.set(lid, arr)
  }

  const colorMap = options.communityColors ?? new Map<string, string>()
  const displayEdges = dedupeEdgesForGraph(edges)
  const internalEdges = displayEdges.map((e) => ({
    source: e.source_node_id,
    target: e.target_node_id,
  }))

  const nameById = new Map(people.map((p) => [p.id, p.name]))

  const selfId = options.selfNodeId ?? null
  const relationFromSelf = new Map<string, string | null>()
  if (selfId) {
    for (const e of displayEdges) {
      if (e.source_node_id === selfId && e.target_node_id !== selfId) {
        relationFromSelf.set(e.target_node_id, e.relation_type)
      } else if (e.target_node_id === selfId && e.source_node_id !== selfId) {
        relationFromSelf.set(e.source_node_id, e.relation_type)
      }
    }
  }

  const relationBorderForPerson = (p: DbPerson) => {
    if (p.is_self || !selfId) return relationTypeToBorderColor(null)
    return relationTypeToBorderColor(relationFromSelf.get(p.id))
  }

  const personNodes: Node[] = []
  const anchors = new Map<string, { x: number; y: number }>()
  const radius = 250
  sortedLocs.forEach((loc, idx) => {
    const angle = (idx / Math.max(1, sortedLocs.length)) * Math.PI * 2
    anchors.set(loc.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  })

  for (const loc of sortedLocs) {
    const group = peopleByLoc.get(loc.id) ?? []
    const locInternal = internalEdges.filter((e) => {
      const a = group.some((p) => p.id === e.source)
      const b = group.some((p) => p.id === e.target)
      return a && b
    })

    const positions = buildPositionsForGroup(
      group,
      locInternal,
      options.runForceLayout,
      anchors.get(loc.id) ?? { x: 0, y: 0 }
    )

    for (const p of group) {
      const fallback = p.is_self
        ? { x: -SELF_NODE_SIZE / 2, y: -SELF_NODE_SIZE / 2 }
        : {
            x: (anchors.get(loc.id)?.x ?? 0) - NORMAL_NODE_SIZE / 2,
            y: (anchors.get(loc.id)?.y ?? 0) - NORMAL_NODE_SIZE / 2,
          }
      const pos = p.is_self ? fallback : positions.get(p.id) ?? fallback
      personNodes.push({
        id: p.id,
        type: 'person',
        position: pos,
        data: {
          name: p.name,
          relationship: p.relationship,
          avatarUrl: p.avatar_url ?? null,
          shiftConnect: options.shiftConnect ?? false,
          justAdded: options.highlightPersonId === p.id,
          relationBorderHex: relationBorderForPerson(p),
          isSelf: p.is_self,
        },
        draggable: !p.is_self,
        style: { zIndex: 2 },
      })
    }
  }

  const orphanGroup = peopleByLoc.get('_none') ?? []
  if (orphanGroup.length > 0) {
    const orphanAnchor = { x: 0, y: 0 }
    const orphanInternal = internalEdges.filter((e) => {
      const a = orphanGroup.some((p) => p.id === e.source)
      const b = orphanGroup.some((p) => p.id === e.target)
      return a && b
    })
    const orphanPositions = buildPositionsForGroup(
      orphanGroup,
      orphanInternal,
      options.runForceLayout,
      orphanAnchor
    )
    for (const p of orphanGroup) {
      const fallback = p.is_self
        ? { x: -SELF_NODE_SIZE / 2, y: -SELF_NODE_SIZE / 2 }
        : {
            x: orphanAnchor.x - NORMAL_NODE_SIZE / 2,
            y: orphanAnchor.y - NORMAL_NODE_SIZE / 2,
          }
      const position = p.is_self ? fallback : orphanPositions.get(p.id) ?? fallback
      personNodes.push({
        id: p.id,
        type: 'person',
        position,
        data: {
          name: p.name,
          relationship: p.relationship,
          avatarUrl: p.avatar_url ?? null,
          shiftConnect: options.shiftConnect ?? false,
          justAdded: options.highlightPersonId === p.id,
          relationBorderHex: relationBorderForPerson(p),
          isSelf: p.is_self,
        },
        draggable: !p.is_self,
        style: { zIndex: 2 },
      })
    }
  }

  const rfEdges: Edge[] = displayEdges.map((e) => {
    const na = nameById.get(e.source_node_id) ?? '?'
    const nb = nameById.get(e.target_node_id) ?? '?'
    const sortedNames = [na, nb].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    )
    const displayName = `${sortedNames[0]} · ${sortedNames[1]}`
    const cid = normalizeCommunityId(e.community_id)
    const baseStroke = cid
      ? colorMap.get(cid) ?? DEFAULT_EDGE_NEUTRAL
      : DEFAULT_EDGE_NEUTRAL
    const communityKey = cid ?? NO_COMMUNITY_KEY

    return {
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      type: 'labeled',
      data: {
        displayName,
        tooltip: displayName,
        baseStroke,
        communityKey,
      },
      style: { stroke: baseStroke, strokeWidth: 0.5, opacity: 1 },
      zIndex: 1,
    }
  })

  return { nodes: personNodes, edges: rfEdges }
}

/** Resolve which saved location (if any) matches a synthetic unplaced group */
export function locationIdFromConstellationNode(
  node: Node | undefined
): string | null {
  if (!node || node.type !== 'constellation') return null
  const id = node.data?.locationId as string | null | undefined
  return id ?? null
}

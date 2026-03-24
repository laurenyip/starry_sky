import type { Edge, Node } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import { layoutPersonNodesInCluster } from '@/lib/force-layout-cluster'
import {
  CONSTELLATION_HEIGHT,
  CONSTELLATION_NODE_ID,
  CONSTELLATION_WIDTH,
  constellationGroupPosition,
  relationshipTitle,
  scatterPersonInGroup,
} from '@/lib/graph-model'

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
}
export type DbEdge = {
  id: string
  source_node_id: string
  target_node_id: string
  label: string
}

export type FlowBuildOptions = {
  highlightPersonId?: string | null
  shiftConnect?: boolean
  runForceLayout?: boolean
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

  const constellationNodes: Node[] = sortedLocs.map((loc, index) => {
    const pos = constellationGroupPosition(index)
    return {
      id: CONSTELLATION_NODE_ID(loc.id),
      type: 'constellation',
      position: pos,
      data: { label: loc.name, locationId: loc.id },
      selectable: false,
      draggable: false,
      style: { zIndex: 0 },
    }
  })

  const peopleByLoc = new Map<string, DbPerson[]>()
  for (const p of people) {
    const lid = p.location_id ?? '_none'
    const arr = peopleByLoc.get(lid) ?? []
    arr.push(p)
    peopleByLoc.set(lid, arr)
  }

  const internalEdges = edges.map((e) => ({
    source: e.source_node_id,
    target: e.target_node_id,
  }))

  const personNodes: Node[] = []

  for (const loc of sortedLocs) {
    const group = peopleByLoc.get(loc.id) ?? []
    const locInternal = internalEdges.filter((e) => {
      const a = group.some((p) => p.id === e.source)
      const b = group.some((p) => p.id === e.target)
      return a && b
    })

    let positions: Map<string, { x: number; y: number }>
    const needsForce = Boolean(
      options.runForceLayout &&
        group.some(
          (p) =>
            p.position_x == null ||
            p.position_y == null ||
            !Number.isFinite(p.position_x) ||
            !Number.isFinite(p.position_y)
        )
    )

    if (needsForce && group.length > 0) {
      positions = layoutPersonNodesInCluster(
        group.map((p) => p.id),
        locInternal,
        CONSTELLATION_WIDTH,
        CONSTELLATION_HEIGHT
      )
    } else {
      positions = new Map()
      group.forEach((p, i) => {
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
          positions.set(p.id, scatterPersonInGroup(i, group.length))
        }
      })
    }

    for (const p of group) {
      const pos = positions.get(p.id) ?? {
        x: CONSTELLATION_WIDTH / 2,
        y: CONSTELLATION_HEIGHT / 2,
      }
      personNodes.push({
        id: p.id,
        type: 'person',
        parentId: CONSTELLATION_NODE_ID(loc.id),
        extent: 'parent',
        position: pos,
        data: {
          name: p.name,
          relationship: p.relationship,
          shiftConnect: options.shiftConnect ?? false,
          justAdded: options.highlightPersonId === p.id,
        },
        style: { zIndex: 2 },
      })
    }
  }

  const orphanGroup = peopleByLoc.get('_none') ?? []
  if (orphanGroup.length > 0) {
    const orphanLocId = 'unplaced'
    const pos = constellationGroupPosition(sortedLocs.length)
    constellationNodes.push({
      id: CONSTELLATION_NODE_ID(orphanLocId),
      type: 'constellation',
      position: pos,
      data: { label: 'Unplaced', locationId: null as unknown as string },
      selectable: false,
      draggable: false,
      style: { zIndex: 0 },
    })
    orphanGroup.forEach((p, i) => {
      const px = p.position_x
      const py = p.position_y
      const position =
        px != null && py != null && Number.isFinite(px) && Number.isFinite(py)
          ? { x: px, y: py }
          : scatterPersonInGroup(i, orphanGroup.length)
      personNodes.push({
        id: p.id,
        type: 'person',
        parentId: CONSTELLATION_NODE_ID(orphanLocId),
        extent: 'parent',
        position,
        data: {
          name: p.name,
          relationship: p.relationship,
          shiftConnect: options.shiftConnect ?? false,
          justAdded: options.highlightPersonId === p.id,
        },
        style: { zIndex: 2 },
      })
    })
  }

  const rfEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    type: 'labeled',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    data: { label: relationshipTitle(e.label) },
    style: { strokeWidth: 2 },
    zIndex: 1,
  }))

  return { nodes: [...constellationNodes, ...personNodes], edges: rfEdges }
}

/** Resolve which saved location (if any) matches a synthetic unplaced group */
export function locationIdFromConstellationNode(
  node: Node | undefined
): string | null {
  if (!node || node.type !== 'constellation') return null
  const id = node.data?.locationId as string | null | undefined
  return id ?? null
}

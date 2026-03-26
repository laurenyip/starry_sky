'use client'

import { useToast } from '@/components/toast-provider'
import { CommunityConnectOverlay } from '@/components/friend-graph/community-connect-overlay'
import { CommunitiesLegend } from '@/components/friend-graph/communities-legend'
import { ConstellationNode } from '@/components/friend-graph/constellation-node'
import { LabeledEdge } from '@/components/friend-graph/labeled-edge'
import { PersonNode } from '@/components/friend-graph/person-node'
import {
  dedupeEdgesForGraph,
  edgesForPersonDeduped,
  pairKey,
} from '@/lib/edge-helpers'
import {
  applyGraphEdgeHighlights,
  type GraphHighlightState,
  NO_COMMUNITY_KEY,
} from '@/lib/edge-highlight'
import {
  buildFlowElements,
  DEFAULT_EDGE_NEUTRAL,
  type DbEdge,
  type DbLocation,
  type DbPerson,
} from '@/lib/flow-build'
import { formatRelativeTime } from '@/lib/format-relative-time'
import {
  CONSTELLATION_HEIGHT,
  CONSTELLATION_NODE_ID,
  CONSTELLATION_WIDTH,
  customAttributesToRows,
  parseCustomAttributes,
  RELATIONSHIP_VALUES,
  relationshipTitle,
  rowsToCustomAttributes,
  scatterPersonInGroup,
  type RelationshipKind,
} from '@/lib/graph-model'
import {
  relationTypeToBorderColor,
} from '@/lib/relation-type-colors'
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { SupabaseClient } from '@supabase/supabase-js'
import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const nodeTypes = { constellation: ConstellationNode, person: PersonNode }
const edgeTypes = { labeled: LabeledEdge }

type PendingConn = { source: string; target: string }
type NodeCommunityRow = {
  node_id: string
  community_id: string
  joined_at: string | null
}
type NodePhotoRow = {
  id: string
  owner_id: string
  node_id: string
  url: string
  is_primary: boolean
  uploaded_at: string
}

function formatSupabaseSchemaError(messages: string[]): string {
  const joined = messages.join(' ')
  const missingTable =
    /locations/i.test(joined) &&
    (/schema cache/i.test(joined) ||
      /PGRST/i.test(joined) ||
      /could not find/i.test(joined))
  const missingColumn =
    /location_id/i.test(joined) &&
    (/column/i.test(joined) || /does not exist/i.test(joined))
  const missingV4 =
    /constellations/i.test(joined) ||
    /node_constellations/i.test(joined) ||
    (/avatar_url/i.test(joined) && !/profiles/i.test(joined))
  const missingV5 =
    /profiles/i.test(joined) && /avatar_url/i.test(joined)
  const missingV6 =
    /communities/i.test(joined) ||
    (/community_id/i.test(joined) &&
      (/edges/i.test(joined) || /column/i.test(joined)))
  const missingV7 =
    /relation_history/i.test(joined) ||
    /relation_type/i.test(joined) ||
    /pos_x/i.test(joined) ||
    /is_self/i.test(joined)
  const missingV8 = /node-avatars/i.test(joined)
  if (
    missingTable ||
    missingColumn ||
    missingV4 ||
    missingV5 ||
    missingV6 ||
    missingV7 ||
    missingV8
  ) {
    return [
      'Database schema is out of date: run the SQL in your Supabase project (SQL Editor):',
      'repo file supabase/fix_add_locations_and_node_columns.sql',
      'and for node avatars / legacy constellations: supabase/migration_v4_social_constellations_avatars.sql',
      'and for profile avatar column: supabase/migration_v5_profiles_avatar_url.sql',
      'and for edge communities (line colors): supabase/migration_v6_edge_communities.sql',
      'and for relation history / pinned positions / “You” node: supabase/migration_v7_relation_history_positions.sql',
      'and for node-avatars bucket + avatar_url: supabase/migration_v8_node_avatar_bucket.sql',
      'Then use Refresh on the dashboard or reload the page.',
      '',
      joined,
    ].join('\n')
  }
  return joined
}

function useShiftHeld() {
  const [shift, setShift] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShift(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShift(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  return shift
}

function constellationHit(
  centerAbs: { x: number; y: number },
  constNodes: Node[]
): { id: string; locationId: string | null } | null {
  let best: { id: string; locationId: string | null; d: number } | null = null
  for (const cn of constNodes) {
    if (cn.type !== 'constellation') continue
    const x0 = cn.position.x
    const y0 = cn.position.y
    const inside =
      centerAbs.x >= x0 &&
      centerAbs.x <= x0 + CONSTELLATION_WIDTH &&
      centerAbs.y >= y0 &&
      centerAbs.y <= y0 + CONSTELLATION_HEIGHT
    if (!inside) continue
    const cx = x0 + CONSTELLATION_WIDTH / 2
    const cy = y0 + CONSTELLATION_HEIGHT / 2
    const d =
      (centerAbs.x - cx) * (centerAbs.x - cx) +
      (centerAbs.y - cy) * (centerAbs.y - cy)
    if (!best || d < best.d) {
      best = {
        id: cn.id,
        locationId: (cn.data?.locationId as string | null) ?? null,
        d,
      }
    }
  }
  return best ? { id: best.id, locationId: best.locationId } : null
}

function personAbsoluteCenter(node: Node, allNodes: Node[]): { x: number; y: number } | null {
  let x = node.position.x
  let y = node.position.y
  let cur: Node | undefined = node
  const seen = new Set<string>()
  while (cur?.parentId && !seen.has(cur.id)) {
    seen.add(cur.id)
    const p = allNodes.find((n) => n.id === cur!.parentId)
    if (!p) break
    x += p.position.x
    y += p.position.y
    cur = p
  }
  return { x: x + 26, y: y + 26 }
}

export function FriendGraphWorkspace(props: {
  supabase: SupabaseClient
  userId: string
}) {
  return (
    <ReactFlowProvider>
      <FriendGraphInner {...props} />
    </ReactFlowProvider>
  )
}

const NODE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const RELATION_TO_YOU_OPTIONS = [
  'friend',
  'family',
  'acquaintance',
  'colleague',
  'mentor',
  'other',
] as const

function personDisplayInitial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

function mimeToNodeExt(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

function formatRememberSavedAt(value: string): string {
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return value
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${date} at ${time}`
}

function isBirthdayKey(value: string): boolean {
  return value.trim().toLowerCase() === 'birthday'
}

function canonicalBirthday(value: string): { canonical: string | null; parseable: boolean } {
  const t = value.trim()
  if (!t) return { canonical: null, parseable: true }
  const ymd = /^\d{4}-\d{2}-\d{2}$/
  if (ymd.test(t)) return { canonical: t, parseable: true }
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) return { canonical: null, parseable: false }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return { canonical: `${yyyy}-${mm}-${dd}`, parseable: true }
}

function formatBirthday(val: string): string {
  if (!val) return ''
  const d = new Date(val + 'T00:00:00')
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function birthdayAge(val: string): number | null {
  if (!val) return null
  const d = new Date(val + 'T00:00:00')
  if (!Number.isFinite(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age >= 0 ? age : null
}

function normalizeCommunityId(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length ? t : null
}

function buildNodeCommunityMap(rows: NodeCommunityRow[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const r of rows) {
    const nid = r.node_id
    const cid = normalizeCommunityId(r.community_id)
    if (!nid || !cid) continue
    const cur = out.get(nid) ?? []
    if (!cur.includes(cid)) cur.push(cid)
    out.set(nid, cur)
  }
  return out
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.trim().replace('#', '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return `rgba(170, 170, 170, ${alpha})`
}

function storagePathFromNodePhotoUrl(url: string): string | null {
  const marker = '/node-photos/'
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  const part = url.slice(idx + marker.length)
  return part.length ? part : null
}

function FriendGraphInner({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}) {
  const { showToast } = useToast()
  const shiftHeld = useShiftHeld()
  const [locations, setLocations] = useState<DbLocation[]>([])
  const [people, setPeople] = useState<DbPerson[]>([])
  const [dbEdges, setDbEdges] = useState<DbEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<DbPerson | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [pendingConn, setPendingConn] = useState<PendingConn | null>(null)
  const [connEdgeRelationToUser, setConnEdgeRelationToUser] = useState('other')

  const [communities, setCommunities] = useState<
    { id: string; name: string; owner_id: string; color: string }[]
  >([])
  const [nodeCommunities, setNodeCommunities] = useState<NodeCommunityRow[]>([])
  const [nodeCommunityMap, setNodeCommunityMap] = useState<Map<string, string[]>>(
    new Map()
  )
  const [graphHighlight, setGraphHighlight] = useState<GraphHighlightState>({
    kind: 'none',
  })
  /** Legend or edge: focused community (null = default graph). */
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null
  )

  const [addConnectionOpen, setAddConnectionOpen] = useState(false)
  const [connectPersonAId, setConnectPersonAId] = useState('')
  const [connectPersonBId, setConnectPersonBId] = useState('')
  const [connectCommunityId, setConnectCommunityId] = useState<string | null>(null)
  const [connectNote, setConnectNote] = useState('')
  const [connectErr, setConnectErr] = useState<string | null>(null)
  const [panelCommunityPicker, setPanelCommunityPicker] = useState('')
  const [pendingCommunityId, setPendingCommunityId] = useState<string | null>(
    null
  )
  const [connEdgeCommunityId, setConnEdgeCommunityId] = useState<string | null>(
    null
  )
  const [newCommunityOpen, setNewCommunityOpen] = useState(false)
  const [newCommunityName, setNewCommunityName] = useState('')
  const [newCommunityColor, setNewCommunityColor] = useState('#FF6B6B')
  const [creatingCommunity, setCreatingCommunity] = useState(false)
  const [assignCommunityId, setAssignCommunityId] = useState<string | null>(null)
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    nodeId: string
    x: number
    y: number
  } | null>(null)

  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLocationId, setNewLocationId] = useState('')
  const [newRel, setNewRel] = useState<RelationshipKind>('friend')
  const [newNotes, setNewNotes] = useState('')
  const [newCustomRows, setNewCustomRows] = useState<
    { key: string; value: string }[]
  >([{ key: '', value: '' }])
  const [addLocInline, setAddLocInline] = useState('')
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const [panelLocId, setPanelLocId] = useState('')
  const [panelNotes, setPanelNotes] = useState('')
  const [panelRows, setPanelRows] = useState<{ key: string; value: string }[]>(
    [{ key: '', value: '' }]
  )
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [panelPhotos, setPanelPhotos] = useState<NodePhotoRow[]>([])
  const [photoLightbox, setPhotoLightbox] = useState<NodePhotoRow | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr, setPanelErr] = useState<string | null>(null)
  const [panelSaveState, setPanelSaveState] = useState<'idle' | 'saved' | 'error'>(
    'idle'
  )
  const [panelName, setPanelName] = useState('')
  const [panelRelationToUser, setPanelRelationToUser] = useState('other')
  const [panelRelationNote, setPanelRelationNote] = useState('')
  const [relationHistory, setRelationHistory] = useState<
    {
      id: string
      previous_relation: string | null
      new_relation: string
      changed_at: string
      note: string | null
    }[]
  >([])
  const [rememberHistory, setRememberHistory] = useState<
    { id: string; content: string; saved_at: string }[]
  >([])
  const [rememberHistoryOpen, setRememberHistoryOpen] = useState(false)
  const [rememberExpandedIds, setRememberExpandedIds] = useState<
    Record<string, boolean>
  >({})
  const addPhotoInputRef = useRef<HTMLInputElement | null>(null)

  const pinSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelSaveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shiftRef = useRef(shiftHeld)
  shiftRef.current = shiftHeld

  const selfNodeId = useMemo(
    () => people.find((p) => p.is_self)?.id ?? null,
    [people]
  )

  const loadedRelationForPanel = useMemo(() => {
    if (!selectedPerson || selectedPerson.is_self || !selfNodeId) return 'other'
    const edgePair = dedupeEdgesForGraph(dbEdges).find(
      (e) =>
        pairKey(e.source_node_id, e.target_node_id) ===
        pairKey(selfNodeId, selectedPerson.id)
    )
    return edgePair?.relation_type?.trim().toLowerCase() ?? 'other'
  }, [selectedPerson, selfNodeId, dbEdges])

  const panelAvatarRingColor = useMemo(() => {
    if (!selectedPerson || selectedPerson.is_self) {
      return relationTypeToBorderColor('other')
    }
    return relationTypeToBorderColor(panelRelationToUser)
  }, [selectedPerson, panelRelationToUser])

  const selectedNodeCommunityIds = useMemo(
    () => (selectedPerson ? nodeCommunityMap.get(selectedPerson.id) ?? [] : []),
    [selectedPerson, nodeCommunityMap]
  )
  const selectedNodeCommunities = useMemo(
    () => communities.filter((c) => selectedNodeCommunityIds.includes(c.id)),
    [communities, selectedNodeCommunityIds]
  )
  const availableCommunitiesForSelectedNode = useMemo(
    () => communities.filter((c) => !selectedNodeCommunityIds.includes(c.id)),
    [communities, selectedNodeCommunityIds]
  )

  const needsForceLayout = useMemo(
    () =>
      people.some((p) => {
        if (
          p.pos_x != null &&
          p.pos_y != null &&
          Number.isFinite(p.pos_x) &&
          Number.isFinite(p.pos_y)
        ) {
          return false
        }
        return (
          p.position_x == null ||
          p.position_y == null ||
          !Number.isFinite(Number(p.position_x)) ||
          !Number.isFinite(Number(p.position_y))
        )
      }),
    [people]
  )

  const communityColorMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of communities) m.set(c.id, c.color)
    return m
  }, [communities])

  const { nodes: initialNodes, edges: baseFlowEdges } = useMemo(
    () =>
      buildFlowElements(locations, people, dbEdges, {
        runForceLayout: needsForceLayout,
        shiftConnect: false,
        highlightPersonId: highlightId,
        communityColors: communityColorMap,
        selfNodeId,
      }),
    [
      locations,
      people,
      dbEdges,
      needsForceLayout,
      highlightId,
      communityColorMap,
      selfNodeId,
    ]
  )

  const selectedCommunityHex = useMemo(() => {
    if (!selectedCommunityId) return DEFAULT_EDGE_NEUTRAL
    if (selectedCommunityId === NO_COMMUNITY_KEY) return DEFAULT_EDGE_NEUTRAL
    const cid = normalizeCommunityId(selectedCommunityId)
    return (cid ? communityColorMap.get(cid) : null) ?? DEFAULT_EDGE_NEUTRAL
  }, [selectedCommunityId, communityColorMap])

  /** Join-order chain for dashed overlay lines (not stored in DB). */
  const communityOverlayPairs = useMemo(() => {
    if (!selectedCommunityId) return []
    if (selectedCommunityId === NO_COMMUNITY_KEY) return []
    const selectedId = normalizeCommunityId(selectedCommunityId)
    if (!selectedId) return []
    const earliestByNode = new Map<string, number>()
    for (const row of nodeCommunities) {
      if (normalizeCommunityId(row.community_id) !== selectedId) continue
      const ts = row.joined_at ? Date.parse(row.joined_at) : Number.NaN
      const when = Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER
      const cur = earliestByNode.get(row.node_id)
      if (cur == null || when < cur) {
        earliestByNode.set(row.node_id, when)
      }
    }
    const orderedNodeIds = [...earliestByNode.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([nodeId]) => nodeId)
    const pairs: { source: string; target: string }[] = []
    for (let i = 0; i < orderedNodeIds.length - 1; i++) {
      pairs.push({ source: orderedNodeIds[i], target: orderedNodeIds[i + 1] })
    }
    return pairs
  }, [selectedCommunityId, nodeCommunities])

  const memberSetForCommunity = useMemo(() => {
    if (!selectedCommunityId) return null
    if (selectedCommunityId === NO_COMMUNITY_KEY) {
      const out = new Set<string>()
      for (const p of people) {
        const ids = nodeCommunityMap.get(p.id) ?? []
        if (ids.length === 0) out.add(p.id)
      }
      return out
    }
    const sid = normalizeCommunityId(selectedCommunityId)
    if (!sid) return new Set<string>()
    const out = new Set<string>()
    for (const [nid, cids] of nodeCommunityMap.entries()) {
      if (cids.includes(sid)) out.add(nid)
    }
    return out
  }, [selectedCommunityId, nodeCommunityMap, people])

  const communityHighlightOpts = useMemo(() => {
    if (!selectedCommunityId) return null
    return {
      selectedCommunityId,
      selectedCommunityHex,
    }
  }, [selectedCommunityId, selectedCommunityHex])

  const nodesForFlow = useMemo(() => {
    if (!memberSetForCommunity) return initialNodes
    const glowHex = selectedCommunityHex
    return initialNodes.map((n) => {
      if (n.type !== 'person') return n
      const inSet = memberSetForCommunity.has(n.id)
      const baseData = (n.data ?? {}) as Record<string, unknown>
      const memberCommunityIds = nodeCommunityMap.get(n.id) ?? []
      const memberDots = memberCommunityIds
        .map((cid) => communityColorMap.get(cid))
        .filter((hex): hex is string => typeof hex === 'string' && hex.length > 0)
      return {
        ...n,
        style: {
          ...n.style,
          opacity: inSet ? 1 : 0.15,
          transition: 'opacity 0.28s ease',
        },
        data: {
          ...baseData,
          communityMemberGlowHex: inSet ? glowHex : null,
          communityColorDots: memberDots,
        },
      }
    })
  }, [initialNodes, memberSetForCommunity, selectedCommunityHex, nodeCommunityMap, communityColorMap])

  const styledEdges = useMemo(
    () =>
      applyGraphEdgeHighlights(
        baseFlowEdges,
        graphHighlight,
        selectedEdge?.id ?? null,
        communityHighlightOpts
      ),
    [baseFlowEdges, graphHighlight, selectedEdge?.id, communityHighlightOpts]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesForFlow)
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges)
  const nodesRef = useRef<Node[]>(nodes)
  nodesRef.current = nodes

  const patchPersonAvatar = useCallback(
    (personId: string, url: string | null) => {
      setPeople((prev) =>
        prev.map((p) => (p.id === personId ? { ...p, avatar_url: url } : p))
      )
      setSelectedPerson((p) =>
        p?.id === personId ? { ...p, avatar_url: url } : p
      )
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== personId || n.type !== 'person') return n
          const d = n.data as Record<string, unknown>
          return { ...n, data: { ...d, avatarUrl: url } }
        })
      )
    },
    [setNodes]
  )

  useEffect(() => {
    const sh = shiftRef.current
    setNodes(
      nodesForFlow.map((n) => {
        if (n.type !== 'person') return n
        const d = n.data as Record<string, unknown>
        return { ...n, data: { ...d, shiftConnect: sh } }
      })
    )
    setEdges(styledEdges)
  }, [nodesForFlow, styledEdges, setNodes, setEdges])

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type !== 'person') return n
        const d = n.data as Record<string, unknown>
        if (d.shiftConnect === shiftHeld) return n
        return { ...n, data: { ...d, shiftConnect: shiftHeld } }
      })
    )
  }, [shiftHeld, setNodes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAssignCommunityId(null)
        setNodeContextMenu(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loadData = useCallback(async (): Promise<DbPerson[] | null> => {
    setLoading(true)
    setError(null)
    const [locsRes, nodesRes, edgesRes, commRes, nodeCommRes] = await Promise.all([
      supabase
        .from('locations')
        .select('id,name,user_id')
        .eq('user_id', userId)
        .order('name'),
      supabase
        .from('nodes')
        .select(
          'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,pos_x,pos_y,avatar_url,is_self'
        )
        .eq('owner_id', userId),
      supabase
        .from('edges')
        .select(
          'id,owner_id,source_node_id,target_node_id,label,community_id,relation_type,created_at'
        )
        .eq('owner_id', userId),
      supabase
        .from('communities')
        .select('id,name,owner_id,color')
        .eq('owner_id', userId)
        .order('name'),
      supabase
        .from('node_communities')
        .select('node_id,community_id,joined_at')
        .eq('owner_id', userId),
    ])
    const errs = [
      locsRes.error,
      nodesRes.error,
      edgesRes.error,
      commRes.error,
      nodeCommRes.error,
    ].filter(Boolean) as { message: string }[]
    if (errs.length) {
      setError(
        formatSupabaseSchemaError(errs.map((e) => e.message))
      )
      setLoading(false)
      return null
    }
    let locs = (locsRes.data ?? []) as DbLocation[]
    if (locs.length === 0) {
      const { error: le } = await supabase
        .from('locations')
        .insert({ user_id: userId, name: 'General' })
      if (!le) {
        const again = await supabase
          .from('locations')
          .select('id,name,user_id')
          .eq('user_id', userId)
          .order('name')
        locs = (again.data ?? []) as DbLocation[]
      }
    }
    setLocations(locs)

    let rawPeople = (nodesRes.data ?? []) as Record<string, unknown>[]
    const hasSelf = rawPeople.some((r) => r.is_self === true)
    if (!hasSelf) {
      const { error: selfErr } = await supabase.from('nodes').insert({
        owner_id: userId,
        name: 'You',
        is_self: true,
        location_id: locs[0]?.id ?? null,
        relationship: 'friend',
        things_to_remember: '',
        custom_attributes: {},
        pos_x: 0,
        pos_y: 0,
      })
      if (!selfErr) {
        const again = await supabase
          .from('nodes')
          .select(
            'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,pos_x,pos_y,avatar_url,is_self'
          )
          .eq('owner_id', userId)
        rawPeople = (again.data ?? []) as Record<string, unknown>[]
      }
    }

    const peopleList: DbPerson[] = rawPeople.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      location_id: (r.location_id as string | null) ?? null,
      relationship: String(r.relationship ?? 'friend'),
      things_to_remember: String(r.things_to_remember ?? ''),
      custom_attributes: (r.custom_attributes as Record<string, unknown>) ?? {},
      position_x:
        r.position_x == null ? null : Number(r.position_x as number),
      position_y:
        r.position_y == null ? null : Number(r.position_y as number),
      pos_x: r.pos_x == null ? null : Number(r.pos_x as number),
      pos_y: r.pos_y == null ? null : Number(r.pos_y as number),
      avatar_url: r.avatar_url ? String(r.avatar_url) : null,
      is_self: Boolean(r.is_self),
    }))
    setPeople(peopleList)
    setDbEdges(
      (edgesRes.data ?? []).map((e) => {
        const row = e as Record<string, unknown>
        const cid = row.community_id
        const rt = row.relation_type
        const createdAt = row.created_at
        return {
          id: e.id as string,
          source_node_id: e.source_node_id as string,
          target_node_id: e.target_node_id as string,
          label: String(e.label ?? 'friend'),
          community_id:
            normalizeCommunityId(cid == null ? null : String(cid)),
          relation_type:
            rt == null || rt === ''
              ? null
              : String(rt).trim().toLowerCase(),
          created_at:
            createdAt == null || createdAt === ''
              ? null
              : String(createdAt),
        }
      })
    )
    setCommunities(
      (commRes.data ?? []) as {
        id: string
        name: string
        owner_id: string
        color: string
      }[]
    )
    const ncRows = (nodeCommRes.data ?? []) as NodeCommunityRow[]
    setNodeCommunities(ncRows)
    setNodeCommunityMap(buildNodeCommunityMap(ncRows))
    setLoading(false)
    return peopleList
  }, [supabase, userId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 2400)
    return () => clearTimeout(t)
  }, [highlightId])

  const refreshNodeCommunities = useCallback(async () => {
    const { data, error: ncErr } = await supabase
      .from('node_communities')
      .select('node_id,community_id,joined_at')
      .eq('owner_id', userId)
    if (ncErr) {
      setError(ncErr.message)
      return
    }
    const rows = (data ?? []) as NodeCommunityRow[]
    setNodeCommunities(rows)
    setNodeCommunityMap(buildNodeCommunityMap(rows))
  }, [supabase, userId])

  const toggleNodeCommunityMembership = useCallback(
    async (nodeId: string, communityId: string) => {
      const cid = normalizeCommunityId(communityId)
      if (!cid) return
      const member = nodeCommunityMap.get(nodeId)?.includes(cid) ?? false
      if (member) {
        const { error: delErr } = await supabase
          .from('node_communities')
          .delete()
          .eq('owner_id', userId)
          .eq('node_id', nodeId)
          .eq('community_id', cid)
        if (delErr) {
          setError(delErr.message)
          return
        }
      } else {
        const { error: insErr } = await supabase.from('node_communities').insert({
          owner_id: userId,
          node_id: nodeId,
          community_id: cid,
          joined_at: new Date().toISOString(),
        })
        if (insErr) {
          setError(insErr.message)
          return
        }
      }
      await refreshNodeCommunities()
    },
    [nodeCommunityMap, supabase, userId, refreshNodeCommunities]
  )

  useEffect(() => {
    if (!selectedPerson) {
      setPanelLocId('')
      setPanelNotes('')
      setPanelRows([{ key: '', value: '' }])
      setPanelRelationToUser('other')
      setPanelRelationNote('')
      setPanelName('')
      return
    }
    setPanelName(selectedPerson.name)
    setPanelLocId(selectedPerson.location_id ?? '')
    setPanelNotes(selectedPerson.things_to_remember)
    setPanelRows(
      customAttributesToRows(parseCustomAttributes(selectedPerson.custom_attributes))
    )
    setPanelErr(null)
    setPanelCommunityPicker('')
    if (selectedPerson.is_self) {
      setPanelRelationToUser('other')
      setPanelRelationNote('')
    }
  }, [selectedPerson])

  useEffect(() => {
    if (!selectedPerson || selectedPerson.is_self) return
    setPanelRelationToUser(loadedRelationForPanel)
  }, [selectedPerson, selectedPerson?.is_self, loadedRelationForPanel])

  useEffect(() => {
    setPanelRelationNote('')
  }, [selectedPerson?.id])

  useEffect(() => {
    if (!selectedPerson || selectedPerson.is_self) {
      setRelationHistory([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('relation_history')
        .select('id, previous_relation, new_relation, changed_at, note')
        .eq('owner_id', userId)
        .eq('node_id', selectedPerson.id)
        .order('changed_at', { ascending: false })
      if (cancelled) return
      if (error) {
        setRelationHistory([])
        return
      }
      setRelationHistory(
        (data ?? []) as {
          id: string
          previous_relation: string | null
          new_relation: string
          changed_at: string
          note: string | null
        }[]
      )
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPerson, supabase, userId])

  const loadRememberHistory = useCallback(
    async (nodeId: string) => {
      const { data, error } = await supabase
        .from('remember_history')
        .select('id, content, saved_at')
        .eq('owner_id', userId)
        .eq('node_id', nodeId)
        .order('saved_at', { ascending: false })
      if (error) {
        setRememberHistory([])
        return
      }
      setRememberHistory(
        (data ?? []) as { id: string; content: string; saved_at: string }[]
      )
    },
    [supabase, userId]
  )

  useEffect(() => {
    if (!selectedPerson) {
      setRememberHistory([])
      setRememberExpandedIds({})
      return
    }
    setRememberExpandedIds({})
    void loadRememberHistory(selectedPerson.id)
  }, [selectedPerson, loadRememberHistory])

  const loadNodePhotos = useCallback(
    async (nodeId: string) => {
      const { data, error: pErr } = await supabase
        .from('node_photos')
        .select('id,owner_id,node_id,url,is_primary,uploaded_at')
        .eq('owner_id', userId)
        .eq('node_id', nodeId)
        .order('uploaded_at', { ascending: true })
      if (pErr) {
        setPanelPhotos([])
        return
      }
      setPanelPhotos((data ?? []) as NodePhotoRow[])
    },
    [supabase, userId]
  )

  useEffect(() => {
    if (!selectedPerson) {
      setPanelPhotos([])
      setPhotoLightbox(null)
      return
    }
    void loadNodePhotos(selectedPerson.id)
  }, [selectedPerson, loadNodePhotos])

  const markSaveSuccess = useCallback(() => {
    setPanelErr(null)
    setPanelSaveState('saved')
    if (panelSaveFlashTimer.current) clearTimeout(panelSaveFlashTimer.current)
    panelSaveFlashTimer.current = setTimeout(() => {
      setPanelSaveState('idle')
    }, 1500)
  }, [])

  const markSaveFail = useCallback((msg?: string) => {
    setPanelErr(msg || 'Failed to save')
    setPanelSaveState('error')
    if (panelSaveFlashTimer.current) clearTimeout(panelSaveFlashTimer.current)
  }, [])

  const refreshSelectedAfterAutosave = useCallback(
    async (personId: string) => {
      const nextPeople = await loadData()
      if (!nextPeople) return
      const p = nextPeople.find((x) => x.id === personId) ?? null
      setSelectedPerson(p)
    },
    [loadData]
  )

  const saveNodePatch = useCallback(
    async (personId: string, patch: Record<string, unknown>) => {
      const { error: uerr } = await supabase
        .from('nodes')
        .update(patch)
        .eq('id', personId)
        .eq('owner_id', userId)
      if (uerr) {
        markSaveFail(uerr.message || 'Failed to save')
        return
      }
      await refreshSelectedAfterAutosave(personId)
      markSaveSuccess()
    },
    [supabase, userId, refreshSelectedAfterAutosave, markSaveSuccess, markSaveFail]
  )

  const saveThingsToRememberWithHistory = useCallback(async () => {
    if (!selectedPerson) return
    const nextContent = panelNotes
    if (nextContent === selectedPerson.things_to_remember) return
    const personId = selectedPerson.id
    const { error: uerr } = await supabase
      .from('nodes')
      .update({ things_to_remember: nextContent })
      .eq('id', personId)
      .eq('owner_id', userId)
    if (uerr) {
      markSaveFail(uerr.message || 'Failed to save')
      return
    }
    const { error: herr } = await supabase.from('remember_history').insert({
      owner_id: userId,
      node_id: personId,
      content: nextContent,
      saved_at: new Date().toISOString(),
    })
    if (herr) {
      markSaveFail(herr.message || 'Failed to save')
      return
    }
    await refreshSelectedAfterAutosave(personId)
    await loadRememberHistory(personId)
    markSaveSuccess()
  }, [
    selectedPerson,
    panelNotes,
    supabase,
    userId,
    refreshSelectedAfterAutosave,
    loadRememberHistory,
    markSaveSuccess,
    markSaveFail,
  ])

  useEffect(() => {
    if (!selectedPerson) return
    const rows = customAttributesToRows(parseCustomAttributes(selectedPerson.custom_attributes))
    let changed = false
    const normalizedRows = rows.map((r) => {
      if (!isBirthdayKey(r.key)) return r
      const parsed = canonicalBirthday(r.value)
      if (!parsed.parseable || !parsed.canonical || parsed.canonical === r.value) return r
      changed = true
      return { ...r, value: parsed.canonical }
    })
    if (!changed) return
    setPanelRows(normalizedRows)
    void saveNodePatch(selectedPerson.id, {
      custom_attributes: rowsToCustomAttributes(normalizedRows),
    })
  }, [selectedPerson, saveNodePatch])

  const saveRelationToUser = useCallback(
    async (nextRelationRaw: string) => {
      if (!selectedPerson || selectedPerson.is_self) return
      const selfRow = people.find((p) => p.is_self)
      const sid = selfRow?.id
      if (!sid) return
      const canonical = dedupeEdgesForGraph(dbEdges)
      const edgePair = canonical.find(
        (e) =>
          pairKey(e.source_node_id, e.target_node_id) === pairKey(sid, selectedPerson.id)
      )
      const prevNorm = edgePair?.relation_type?.trim().toLowerCase() ?? 'other'
      const nextNorm = nextRelationRaw.trim().toLowerCase()
      const noteTrim = panelRelationNote.trim()
      const shouldChangeRelation =
        prevNorm !== nextNorm && (edgePair != null || nextNorm !== 'other')
      if (!shouldChangeRelation) return
      if (!edgePair) {
        const { error: insE } = await supabase.from('edges').insert([
          {
            owner_id: userId,
            source_node_id: sid,
            target_node_id: selectedPerson.id,
            label: 'connected',
            community_id: null,
            relation_type: nextNorm,
          },
          {
            owner_id: userId,
            source_node_id: selectedPerson.id,
            target_node_id: sid,
            label: 'connected',
            community_id: null,
            relation_type: nextNorm,
          },
        ])
        if (insE) {
          markSaveFail(insE.message || 'Failed to save')
          return
        }
      } else {
        const a = edgePair.source_node_id
        const b = edgePair.target_node_id
        const { error: e1 } = await supabase
          .from('edges')
          .update({ relation_type: nextNorm })
          .eq('owner_id', userId)
          .eq('source_node_id', a)
          .eq('target_node_id', b)
        const { error: e2 } = await supabase
          .from('edges')
          .update({ relation_type: nextNorm })
          .eq('owner_id', userId)
          .eq('source_node_id', b)
          .eq('target_node_id', a)
        if (e1 || e2) {
          markSaveFail((e1 ?? e2)?.message ?? 'Failed to save')
          return
        }
      }
      const { error: histE } = await supabase.from('relation_history').insert({
        owner_id: userId,
        node_id: selectedPerson.id,
        previous_relation: edgePair?.relation_type ?? null,
        new_relation: nextNorm,
        note: noteTrim.length ? noteTrim : null,
      })
      if (histE) {
        markSaveFail(histE.message || 'Failed to save')
        return
      }
      setPanelRelationNote('')
      await refreshSelectedAfterAutosave(selectedPerson.id)
      markSaveSuccess()
    },
    [
      selectedPerson,
      people,
      dbEdges,
      panelRelationNote,
      supabase,
      userId,
      refreshSelectedAfterAutosave,
      markSaveSuccess,
      markSaveFail,
    ]
  )

  const deletePerson = useCallback(async () => {
    if (!selectedPerson) return
    if (selectedPerson.is_self) {
      showToast('The “You” node can’t be removed from the graph.', 'error')
      return
    }
    setPanelSaving(true)
    await supabase.from('nodes').delete().eq('id', selectedPerson.id).eq('owner_id', userId)
    setPanelSaving(false)
    setSelectedPerson(null)
    await loadData()
  }, [selectedPerson, supabase, userId, loadData, showToast])

  const addConnectionFromModal = useCallback(async () => {
    const personAId = connectPersonAId
    const personBId = connectPersonBId
    if (!personAId || !personBId) {
      setConnectErr('Select both people.')
      return
    }
    if (personAId === personBId) {
      setConnectErr('Choose two different people.')
      return
    }
    const dup = dbEdges.some(
      (e) => pairKey(e.source_node_id, e.target_node_id) === pairKey(personAId, personBId)
    )
    if (dup) {
      setConnectErr('These two people are already connected.')
      return
    }
    setConnectErr(null)
    const payload = {
      owner_id: userId,
      source_node_id: personAId,
      target_node_id: personBId,
      community_id: normalizeCommunityId(connectCommunityId),
      label: connectNote.trim() || null,
      relation_type: null,
    }
    const { error: insErr } = await supabase.from('edges').insert(payload)
    if (insErr) {
      setConnectErr(insErr.message || 'Failed to add connection.')
      return
    }
    setAddConnectionOpen(false)
    setConnectPersonAId('')
    setConnectPersonBId('')
    setConnectCommunityId(null)
    setConnectNote('')
    await loadData()
    showToast('Connection added ✓', 'success')
  }, [
    connectPersonAId,
    connectPersonBId,
    connectCommunityId,
    connectNote,
    dbEdges,
    supabase,
    userId,
    loadData,
    showToast,
  ])

  const removePanelConnection = useCallback(
    async (otherId: string) => {
      if (!selectedPerson) return
      const a = selectedPerson.id
      const b = otherId
      await supabase
        .from('edges')
        .delete()
        .eq('owner_id', userId)
        .eq('source_node_id', a)
        .eq('target_node_id', b)
      await supabase
        .from('edges')
        .delete()
        .eq('owner_id', userId)
        .eq('source_node_id', b)
        .eq('target_node_id', a)
      await loadData()
    },
    [selectedPerson, supabase, userId, loadData]
  )

  const createCommunityFromModal = useCallback(async () => {
    const name = newCommunityName.trim()
    if (!name) return
    setCreatingCommunity(true)
    const { error: e } = await supabase.from('communities').insert({
      owner_id: userId,
      name,
      color: newCommunityColor,
    })
    setCreatingCommunity(false)
    if (e) {
      showToast(e.message, 'error')
      return
    }
    setNewCommunityOpen(false)
    setNewCommunityName('')
    setNewCommunityColor('#FF6B6B')
    showToast('Community created.', 'success')
    await loadData()
  }, [
    newCommunityName,
    newCommunityColor,
    supabase,
    userId,
    loadData,
    showToast,
  ])

  const setMainPhoto = useCallback(
    async (photo: NodePhotoRow) => {
      if (!selectedPerson) return
      const personId = selectedPerson.id
      const { error: clearErr } = await supabase
        .from('node_photos')
        .update({ is_primary: false })
        .eq('owner_id', userId)
        .eq('node_id', personId)
      if (clearErr) {
        showToast(clearErr.message, 'error')
        return
      }
      const { error: setErr } = await supabase
        .from('node_photos')
        .update({ is_primary: true })
        .eq('owner_id', userId)
        .eq('id', photo.id)
      if (setErr) {
        showToast(setErr.message, 'error')
        return
      }
      const { error: nErr } = await supabase
        .from('nodes')
        .update({ avatar_url: photo.url })
        .eq('owner_id', userId)
        .eq('id', personId)
      if (nErr) {
        showToast(nErr.message, 'error')
        return
      }
      patchPersonAvatar(personId, photo.url)
      await loadNodePhotos(personId)
      setPhotoLightbox(null)
      showToast('Main photo updated.', 'success')
    },
    [selectedPerson, supabase, userId, patchPersonAvatar, loadNodePhotos, showToast]
  )

  const deletePhoto = useCallback(
    async (photo: NodePhotoRow) => {
      if (!selectedPerson) return
      const personId = selectedPerson.id
      const path = storagePathFromNodePhotoUrl(photo.url)
      if (path) {
        await supabase.storage.from('node-photos').remove([path])
      }
      const { error: delErr } = await supabase
        .from('node_photos')
        .delete()
        .eq('owner_id', userId)
        .eq('id', photo.id)
      if (delErr) {
        showToast(delErr.message, 'error')
        return
      }
      const remaining = panelPhotos.filter((p) => p.id !== photo.id)
      if (photo.is_primary) {
        const nextPrimary = remaining[0] ?? null
        if (nextPrimary) {
          const { error: setErr } = await supabase
            .from('node_photos')
            .update({ is_primary: true })
            .eq('owner_id', userId)
            .eq('id', nextPrimary.id)
          if (!setErr) {
            await supabase
              .from('nodes')
              .update({ avatar_url: nextPrimary.url })
              .eq('owner_id', userId)
              .eq('id', personId)
            patchPersonAvatar(personId, nextPrimary.url)
          }
        } else {
          await supabase
            .from('nodes')
            .update({ avatar_url: null })
            .eq('owner_id', userId)
            .eq('id', personId)
          patchPersonAvatar(personId, null)
        }
      }
      await loadNodePhotos(personId)
      setPhotoLightbox(null)
      showToast('Photo deleted.', 'success')
    },
    [selectedPerson, supabase, userId, panelPhotos, loadNodePhotos, patchPersonAvatar, showToast]
  )

  const uploadNodePhoto = useCallback(
    async (file: File) => {
      if (!selectedPerson) return
      if (!NODE_IMAGE_TYPES.includes(file.type as (typeof NODE_IMAGE_TYPES)[number])) {
        showToast('Please choose a JPEG, PNG, or WebP image.', 'error')
        return
      }
      const personId = selectedPerson.id
      const ext = mimeToNodeExt(file.type)
      const path = `${userId}/${personId}/${Date.now()}.${ext}`

      setAvatarUploading(true)
      setPanelErr(null)

      const { error: upErr } = await supabase.storage
        .from('node-photos')
        .upload(path, file, { upsert: false, cacheControl: '3600' })

      if (upErr) {
        setAvatarUploading(false)
        showToast(upErr.message, 'error')
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('node-photos').getPublicUrl(path)

      const isFirst = panelPhotos.length === 0
      const { error: iErr } = await supabase.from('node_photos').insert({
        owner_id: userId,
        node_id: personId,
        url: publicUrl,
        is_primary: isFirst,
      })
      if (iErr) {
        setAvatarUploading(false)
        showToast(iErr.message, 'error')
        return
      }
      if (isFirst) {
        const { error: nErr } = await supabase
          .from('nodes')
          .update({ avatar_url: publicUrl })
          .eq('id', personId)
          .eq('owner_id', userId)
        if (!nErr) patchPersonAvatar(personId, publicUrl)
      }
      await loadNodePhotos(personId)
      setAvatarUploading(false)
      showToast('Photo uploaded.', 'success')
    },
    [
      selectedPerson,
      supabase,
      userId,
      panelPhotos.length,
      loadNodePhotos,
      patchPersonAvatar,
      showToast,
    ]
  )

  const addLocation = useCallback(
    async (name: string): Promise<string | null> => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const { data, error: e } = await supabase
        .from('locations')
        .insert({ user_id: userId, name: trimmed })
        .select('id')
        .single()
      if (e) {
        setSubmitErr(e.message)
        return null
      }
      await loadData()
      return data?.id as string
    },
    [supabase, userId, loadData]
  )

  const submitNewPerson = useCallback(async () => {
    setSubmitErr(null)
    const name = newName.trim()
    if (!name) {
      setSubmitErr('Name is required.')
      return
    }
    let locId = newLocationId
    if (addLocInline.trim()) {
      const id = await addLocation(addLocInline)
      if (!id) return
      locId = id
      setAddLocInline('')
    }
    if (!locId) {
      setSubmitErr('Choose a location or add a new one.')
      return
    }
    const group = people.filter((p) => p.location_id === locId)
    const pos = scatterPersonInGroup(group.length, group.length + 1)
    const custom = rowsToCustomAttributes(newCustomRows)
    const { data: inserted, error: insErr } = await supabase
      .from('nodes')
      .insert({
        owner_id: userId,
        name,
        location_id: locId,
        relationship: newRel,
        things_to_remember: newNotes,
        custom_attributes: custom,
        position_x: pos.x,
        position_y: pos.y,
      })
      .select('id')
      .single()
    if (insErr) {
      setSubmitErr(insErr.message)
      return
    }
    setAddPersonOpen(false)
    setNewName('')
    setNewLocationId('')
    setNewRel('friend')
    setNewNotes('')
    setNewCustomRows([{ key: '', value: '' }])
    setHighlightId(inserted?.id as string)
    await loadData()
  }, [
    newName,
    newLocationId,
    newRel,
    newNotes,
    newCustomRows,
    addLocInline,
    people,
    supabase,
    userId,
    addLocation,
    loadData,
  ])

  const confirmPendingEdge = useCallback(async () => {
    if (!pendingConn) return
    const exists = dbEdges.some(
      (e) =>
        pairKey(e.source_node_id, e.target_node_id) ===
        pairKey(pendingConn.source, pendingConn.target)
    )
    if (exists) {
      setPendingConn(null)
      return
    }
    const cid = normalizeCommunityId(pendingCommunityId)
    const involvesSelf =
      selfNodeId != null &&
      (pendingConn.source === selfNodeId || pendingConn.target === selfNodeId)
    const relationType = involvesSelf
      ? connEdgeRelationToUser.trim().toLowerCase()
      : null
    const { error: e } = await supabase.from('edges').insert([
      {
        owner_id: userId,
        source_node_id: pendingConn.source,
        target_node_id: pendingConn.target,
        label: 'connected',
        community_id: cid,
        relation_type: relationType,
      },
      {
        owner_id: userId,
        source_node_id: pendingConn.target,
        target_node_id: pendingConn.source,
        label: 'connected',
        community_id: cid,
        relation_type: relationType,
      },
    ])
    if (e) setError(e.message)
    setPendingConn(null)
    setPendingCommunityId(null)
    await loadData()
  }, [
    pendingConn,
    pendingCommunityId,
    connEdgeRelationToUser,
    selfNodeId,
    dbEdges,
    supabase,
    userId,
    loadData,
  ])

  const saveEdgeLabel = useCallback(async (nextRelationToUser?: string) => {
    if (!selectedEdge) return
    const raw = dbEdges.find((d) => d.id === selectedEdge.id)
    if (!raw) return
    const a = raw.source_node_id
    const b = raw.target_node_id
    const cid = normalizeCommunityId(connEdgeCommunityId)
    const involvesSelf =
      selfNodeId != null && (a === selfNodeId || b === selfNodeId)
    const relationType = involvesSelf
      ? (nextRelationToUser ?? connEdgeRelationToUser).trim().toLowerCase()
      : raw.relation_type
    const { error: e1 } = await supabase
      .from('edges')
      .update({ community_id: cid, relation_type: relationType })
      .eq('owner_id', userId)
      .eq('source_node_id', a)
      .eq('target_node_id', b)
    const { error: e2 } = await supabase
      .from('edges')
      .update({ community_id: cid, relation_type: relationType })
      .eq('owner_id', userId)
      .eq('source_node_id', b)
      .eq('target_node_id', a)
    if (e1 || e2) setError((e1 ?? e2)?.message ?? 'Update failed')
    setSelectedCommunityId(null)
    setGraphHighlight({ kind: 'none' })
    setSelectedEdge(null)
    await loadData()
  }, [
    selectedEdge,
    dbEdges,
    supabase,
    userId,
    connEdgeRelationToUser,
    connEdgeCommunityId,
    selfNodeId,
    loadData,
  ])

  const deleteEdge = useCallback(async () => {
    if (!selectedEdge) return
    const raw = dbEdges.find((d) => d.id === selectedEdge.id)
    if (!raw) return
    const a = raw.source_node_id
    const b = raw.target_node_id
    await supabase
      .from('edges')
      .delete()
      .eq('owner_id', userId)
      .eq('source_node_id', a)
      .eq('target_node_id', b)
    await supabase
      .from('edges')
      .delete()
      .eq('owner_id', userId)
      .eq('source_node_id', b)
      .eq('target_node_id', a)
    setSelectedCommunityId(null)
    setGraphHighlight({ kind: 'none' })
    setSelectedEdge(null)
    await loadData()
  }, [selectedEdge, dbEdges, supabase, userId, loadData])

  const schedulePersistPinnedPosition = useCallback(
    (id: string, x: number, y: number) => {
      if (pinSaveTimer.current) clearTimeout(pinSaveTimer.current)
      pinSaveTimer.current = setTimeout(() => {
        void (async () => {
          const { error } = await supabase
            .from('nodes')
            .update({ pos_x: x, pos_y: y })
            .eq('id', id)
            .eq('owner_id', userId)
          if (error) setError(error.message)
          setPeople((prev) =>
            prev.map((p) =>
              p.id === id ? { ...p, pos_x: x, pos_y: y } : p
            )
          )
        })()
      }, 500)
    },
    [supabase, userId]
  )

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return
    if (c.source === c.target) return
    setConnEdgeRelationToUser('other')
    setPendingCommunityId(null)
    setPendingConn({ source: c.source, target: c.target })
  }, [])

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== 'person') return
      if (selfNodeId && node.id === selfNodeId) return
      const { x, y } = node.position
      schedulePersistPinnedPosition(node.id, x, y)

      const fresh = nodesRef.current
      const consts = fresh.filter((n) => n.type === 'constellation')
      const center = personAbsoluteCenter(node, fresh)
      if (!center) return
      const hit = constellationHit(center, consts)
      if (!hit || hit.locationId == null) return

      const currentLoc = people.find((p) => p.id === node.id)?.location_id
      if (hit.id === CONSTELLATION_NODE_ID('unplaced')) return

      if (currentLoc === hit.locationId) return

      if (pinSaveTimer.current) {
        clearTimeout(pinSaveTimer.current)
        pinSaveTimer.current = null
      }

      const group = people.filter(
        (p) => p.location_id === hit.locationId && p.id !== node.id
      )
      const pos = scatterPersonInGroup(group.length, group.length + 1)

      void (async () => {
        const { error: uerr } = await supabase
          .from('nodes')
          .update({
            location_id: hit.locationId,
            position_x: pos.x,
            position_y: pos.y,
            pos_x: null,
            pos_y: null,
          })
          .eq('id', node.id)
          .eq('owner_id', userId)
        if (uerr) setError(uerr.message)
        await loadData()
      })()
    },
    [people, selfNodeId, schedulePersistPinnedPosition, supabase, userId, loadData]
  )

  useEffect(() => {
    return () => {
      if (pinSaveTimer.current) clearTimeout(pinSaveTimer.current)
    }
  }, [])

  const hint = (
    <p className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(24rem,calc(100%-1.5rem))] rounded-lg border border-zinc-200/80 bg-background/90 px-3 py-2 text-[11px] text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:text-zinc-400">
      Line colors show <span className="font-medium">communities</span>. Hold{' '}
      <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-600">Shift</kbd>{' '}
      to connect people. Drag nodes; drop into another region to change location.
      Click an edge or the legend to highlight a community; click a person to
      highlight their ties.
    </p>
  )

  if (loading && people.length === 0 && locations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading graph…
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {error ? (
        <div
          className="m-3 shrink-0 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {hint}
      <div className="relative min-h-0 w-full flex-1">
      {assignCommunityId ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-zinc-300/80 bg-background/95 px-3 py-1 text-xs text-zinc-700 shadow dark:border-zinc-700 dark:text-zinc-300">
          Click nodes to add/remove from{' '}
          <span className="font-semibold">
            {communities.find((c) => c.id === assignCommunityId)?.name ?? 'community'}
          </span>
          . Click ✏️ again or press Esc to exit.
        </div>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Strict}
        nodesConnectable={shiftHeld}
        elementsSelectable
        onNodeClick={(_, n) => {
          setNodeContextMenu(null)
          if (assignCommunityId && n.type === 'person') {
            void toggleNodeCommunityMembership(n.id, assignCommunityId)
            return
          }
          setSelectedCommunityId(null)
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
          setSelectedEdge(null)
          if (n.type === 'person') {
            setGraphHighlight({ kind: 'node', nodeId: n.id })
            const row = people.find((p) => p.id === n.id)
            if (row) setSelectedPerson(row)
          }
        }}
        onPaneClick={() => {
          setNodeContextMenu(null)
          setSelectedCommunityId(null)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
          setSelectedEdge(null)
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
        }}
        onEdgeClick={(_, e) => {
          setNodeContextMenu(null)
          setSelectedPerson(null)
          setEdges((eds) =>
            eds.map((edge) => ({ ...edge, selected: edge.id === e.id }))
          )
          setSelectedEdge(e)
          const raw = dbEdges.find((d) => d.id === e.id)
          setConnEdgeRelationToUser(raw?.relation_type ?? 'other')
          setConnEdgeCommunityId(normalizeCommunityId(raw?.community_id ?? null))
          const d = e.data as { communityKey?: string }
          const key = normalizeCommunityId(d?.communityKey ?? null) ?? NO_COMMUNITY_KEY
          setSelectedCommunityId(key)
          setGraphHighlight({ kind: 'none' })
        }}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={(ev, n) => {
          ev.preventDefault()
          if (n.type !== 'person') return
          setNodeContextMenu({
            nodeId: n.id,
            x: ev.clientX,
            y: ev.clientY,
          })
        }}
        fitView
        minZoom={0.35}
        maxZoom={1.4}
        className={`touch-none h-full w-full bg-zinc-50/50 dark:bg-zinc-950/40 ${
          assignCommunityId ? 'cursor-crosshair' : ''
        }`}
      >
        <Background gap={22} size={1.2} />
        {selectedCommunityId && communityOverlayPairs.length > 0 ? (
          <CommunityConnectOverlay
            pairs={communityOverlayPairs}
            stroke={selectedCommunityHex}
          />
        ) : null}
        <Controls showInteractive={false} />
        <MiniMap
          className="!bg-background/90 dark:!bg-zinc-900/90"
          zoomable
          pannable
          maskColor="rgba(0,0,0,0.12)"
        />
      </ReactFlow>
      <CommunitiesLegend
        communities={communities.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
        activeCommunityKey={selectedCommunityId}
        assignCommunityId={assignCommunityId}
        onPickCommunity={(key) => {
          const normalizedKey =
            key === NO_COMMUNITY_KEY
              ? NO_COMMUNITY_KEY
              : normalizeCommunityId(key) ?? NO_COMMUNITY_KEY
          if (selectedCommunityId === normalizedKey) {
            setSelectedCommunityId(null)
            setGraphHighlight({ kind: 'none' })
            setSelectedPerson(null)
            setSelectedEdge(null)
            setConnEdgeCommunityId(null)
            setEdges((eds) =>
              eds.map((edge) => ({ ...edge, selected: false }))
            )
            return
          }
          setSelectedCommunityId(normalizedKey)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
          setSelectedEdge(null)
          setConnEdgeCommunityId(null)
          setEdges((eds) =>
            eds.map((edge) => ({ ...edge, selected: false }))
          )
        }}
        onToggleAssignCommunity={(communityId) => {
          setAssignCommunityId((prev) => (prev === communityId ? null : communityId))
          setNodeContextMenu(null)
        }}
        onNewCommunity={() => {
          setNewCommunityName('')
          setNewCommunityColor('#FF6B6B')
          setNewCommunityOpen(true)
        }}
      />
      {nodeContextMenu ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setNodeContextMenu(null)}
            aria-hidden
          />
          <div
            className="fixed z-40 min-w-48 rounded-lg border border-zinc-200 bg-background p-2 shadow-xl dark:border-zinc-700"
            style={{ left: nodeContextMenu.x + 8, top: nodeContextMenu.y + 8 }}
          >
            <p className="px-1 pb-1 text-xs font-semibold text-zinc-500">
              Add to community
            </p>
            <div className="max-h-56 overflow-y-auto">
              {communities.map((c) => {
                const isMember =
                  nodeCommunityMap.get(nodeContextMenu.nodeId)?.includes(c.id) ?? false
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      void toggleNodeCommunityMembership(nodeContextMenu.nodeId, c.id)
                      setNodeContextMenu(null)
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1">{c.name}</span>
                    {isMember ? <span className="text-xs">✓</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : null}
      </div>

      <div className="pointer-events-auto fixed bottom-4 right-4 z-20 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setAddPersonOpen(true)
            setSubmitErr(null)
            setNewLocationId(locations[0]?.id ?? '')
          }}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-lg"
        >
          + Add person
        </button>
        <button
          type="button"
          onClick={() => {
            if (people.length < 2) {
              showToast('Add at least two people before creating a connection.', 'error')
              return
            }
            setConnectErr(null)
            const a = people[0]?.id ?? ''
            const b = people.find((p) => p.id !== a)?.id ?? ''
            setConnectPersonAId(a)
            setConnectPersonBId(b)
            setConnectCommunityId(null)
            setConnectNote('')
            setAddConnectionOpen(true)
          }}
          className="rounded-full border border-zinc-300 bg-background px-4 py-3 text-sm font-medium shadow dark:border-zinc-600"
        >
          + Add Connection
        </button>
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-full border border-zinc-300 bg-background px-4 py-3 text-sm font-medium shadow dark:border-zinc-600"
        >
          Refresh
        </button>
      </div>

      {addPersonOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
          <div
 role="dialog"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-background p-6 shadow-xl dark:border-zinc-700"
          >
            <h2 className="text-lg font-semibold">Add person</h2>
            {submitErr ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {submitErr}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm font-medium">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
              />
              <label className="text-sm font-medium">Location</label>
              <select
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
              >
                <option value="">Select…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  placeholder="New location name"
                  value={addLocInline}
                  onChange={(e) => setAddLocInline(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                />
              </div>
              <label className="text-sm font-medium">Relationship</label>
              <div className="flex flex-wrap gap-1.5">
                {RELATIONSHIP_VALUES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRel(r)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      newRel === r
                        ? 'bg-foreground text-background'
                        : 'border border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {relationshipTitle(r)}
                  </button>
                ))}
              </div>
              <label className="text-sm font-medium">Things to remember</label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={3}
                className="resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Custom fields</span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() =>
                    setNewCustomRows((r) => [...r, { key: '', value: '' }])
                  }
                >
                  + Add field
                </button>
              </div>
              {newCustomRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="Label"
                    value={row.key}
                    onChange={(e) =>
                      setNewCustomRows((rows) =>
                        rows.map((x, j) =>
                          j === i ? { ...x, key: e.target.value } : x
                        )
                      )
                    }
                    className="w-2/5 rounded-md border px-2 py-1 text-xs dark:border-zinc-600"
                  />
                  <input
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) =>
                      setNewCustomRows((rows) =>
                        rows.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x
                        )
                      )
                    }
                    className="min-w-0 flex-1 rounded-md border px-2 py-1 text-xs dark:border-zinc-600"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-foreground py-2 text-sm font-medium text-background"
                onClick={() => void submitNewPerson()}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setAddPersonOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addConnectionOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-background p-6 dark:border-zinc-700">
            <h3 className="font-semibold">Add connection</h3>
            {connectErr ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {connectErr}
              </p>
            ) : null}
            <label className="mt-3 block text-sm font-medium">Person A</label>
            <select
              value={connectPersonAId}
              onChange={(e) => {
                const nextA = e.target.value
                setConnectPersonAId(nextA)
                if (connectPersonBId === nextA) {
                  const nextB = people.find((p) => p.id !== nextA)?.id ?? ''
                  setConnectPersonBId(nextB)
                }
              }}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              <option value="">Select person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-medium">Person B</label>
            <select
              value={connectPersonBId}
              onChange={(e) => setConnectPersonBId(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              <option value="">Select person…</option>
              {people
                .filter((p) => p.id !== connectPersonAId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <label className="mt-3 block text-sm font-medium">Community (optional)</label>
            <select
              value={connectCommunityId ?? ''}
              onChange={(e) => setConnectCommunityId(normalizeCommunityId(e.target.value))}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              <option value="">General / None</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-medium">Connection note (optional)</label>
            <input
              value={connectNote}
              onChange={(e) => setConnectNote(e.target.value)}
              placeholder="Optional note"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-foreground py-2 text-sm text-background"
                onClick={() => void addConnectionFromModal()}
              >
                Connect
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setAddConnectionOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingConn ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-background p-6 dark:border-zinc-700">
            <h3 className="font-semibold">New connection</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Create a bidirectional connection.
            </p>
            {selfNodeId != null &&
            (pendingConn.source === selfNodeId || pendingConn.target === selfNodeId) ? (
              <>
                <label className="mt-3 block text-sm font-medium">
                  Relationship to You
                </label>
                <select
                  value={connEdgeRelationToUser}
                  onChange={(e) => setConnEdgeRelationToUser(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm capitalize dark:border-zinc-600"
                >
                  {RELATION_TO_YOU_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label className="mt-3 block text-sm font-medium">Community (optional)</label>
            <select
              value={pendingCommunityId ?? ''}
              onChange={(e) =>
                setPendingCommunityId(normalizeCommunityId(e.target.value || null))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              <option value="">No community</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-foreground py-2 text-sm text-background"
                onClick={() => void confirmPendingEdge()}
              >
                Create
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => {
                  setPendingConn(null)
                  setPendingCommunityId(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEdge ? (
        <div className="fixed bottom-24 left-1/2 z-40 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-background p-4 shadow-xl dark:border-zinc-700">
          <p className="text-sm font-medium">Edit connection</p>
          {selfNodeId != null &&
          (selectedEdge.source === selfNodeId || selectedEdge.target === selfNodeId) ? (
            <>
              <label className="mt-3 block text-sm font-medium">Relationship to You</label>
              <select
                value={connEdgeRelationToUser}
                onChange={(e) => {
                  const next = e.target.value
                  setConnEdgeRelationToUser(next)
                  void saveEdgeLabel(next)
                }}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm capitalize dark:border-zinc-600"
              >
                {RELATION_TO_YOU_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label className="mt-3 block text-sm font-medium">Community (optional)</label>
          <select
            value={connEdgeCommunityId ?? ''}
            onChange={(e) =>
              setConnEdgeCommunityId(normalizeCommunityId(e.target.value || null))
            }
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
          >
            <option value="">No community</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md bg-foreground py-2 text-sm text-background"
              onClick={() => void saveEdgeLabel()}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
              onClick={() => void deleteEdge()}
            >
              Delete
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
              onClick={() => {
                setSelectedCommunityId(null)
                setGraphHighlight({ kind: 'none' })
                setSelectedEdge(null)
                setEdges((eds) =>
                  eds.map((edge) => ({ ...edge, selected: false }))
                )
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {selectedPerson ? (
        <aside className="fixed top-16 right-0 bottom-0 z-30 flex w-72 sm:w-80 flex-col border-l border-zinc-200 bg-background shadow-2xl dark:border-zinc-800">
          <div className="border-b p-3 dark:border-zinc-800">
            <div className="flex justify-end">
              <button
                type="button"
                className="text-2xl leading-none text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                onClick={() => {
                  setSelectedCommunityId(null)
                  setGraphHighlight({ kind: 'none' })
                  setSelectedPerson(null)
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mt-1 flex flex-col items-center gap-2 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  {selectedPerson.avatar_url ? (
                    <Image
                      src={selectedPerson.avatar_url}
                      alt=""
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-2xl font-bold text-zinc-700 dark:text-zinc-200">
                      {personDisplayInitial(panelName || selectedPerson.name)}
                    </span>
                  )}
                  {avatarUploading ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
                      aria-busy
                    >
                      <span
                        className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent dark:border-zinc-500"
                        role="status"
                      />
                    </div>
                  ) : null}
                  <label className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-foreground text-background shadow-md transition hover:opacity-90">
                    <span className="sr-only">Upload photo</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574v6.176A2.25 2.25 0 004.5 18h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                      />
                    </svg>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={avatarUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void uploadNodePhoto(f)
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="w-full flex-1 text-center sm:text-left">
                <textarea
                  value={panelName}
                  onChange={(e) => setPanelName(e.target.value)}
                  onBlur={() => {
                    const nameTrim = panelName.trim()
                    if (!nameTrim) {
                      setPanelName(selectedPerson.name)
                      return
                    }
                    if (nameTrim === selectedPerson.name) return
                    void saveNodePatch(selectedPerson.id, { name: nameTrim })
                  }}
                  aria-label="Name"
                  rows={2}
                  className="mt-0.5 w-full resize-none border-b border-gray-300 bg-transparent px-1 py-0.5 text-base font-semibold text-foreground outline-none focus:border-blue-400 whitespace-normal break-words"
                />
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
                  Your relationship to them (category)
                </p>
              </div>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto py-1">
              {panelPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
                  onClick={() => setPhotoLightbox(photo)}
                >
                  <Image
                    src={photo.url}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                  {photo.is_primary ? (
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">
                      Main
                    </span>
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
                disabled={avatarUploading}
                onClick={() => addPhotoInputRef.current?.click()}
              >
                {avatarUploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent dark:border-zinc-500" />
                ) : (
                  '+ Add Photo'
                )}
              </button>
              <input
                ref={addPhotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void uploadNodePhoto(f)
                }}
              />
            </div>
            <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Location</label>
              <select
                value={panelLocId}
                onChange={(e) => {
                  const nextLocId = e.target.value
                  setPanelLocId(nextLocId)
                  const prevLocId = selectedPerson.location_id ?? ''
                  if (nextLocId === prevLocId) return
                  let pos: { x: number; y: number } | undefined
                  if (nextLocId) {
                    const group = people.filter(
                      (p) => p.location_id === nextLocId && p.id !== selectedPerson.id
                    )
                    pos = scatterPersonInGroup(group.length, group.length + 1)
                  } else {
                    pos = scatterPersonInGroup(0, 1)
                  }
                  void saveNodePatch(selectedPerson.id, {
                    location_id: nextLocId || null,
                    position_x: pos.x,
                    position_y: pos.y,
                    pos_x: null,
                    pos_y: null,
                  })
                }}
                className="mt-1 w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
              >
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            {!selectedPerson.is_self ? (
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-400">
                  Relationship to You
                </label>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Controls the ring colour on the graph (how they connect to{' '}
                  <span className="font-medium">You</span>).
                </p>
                <select
                  value={panelRelationToUser}
                  onChange={(e) => {
                    const next = e.target.value
                    setPanelRelationToUser(next)
                    void saveRelationToUser(next)
                  }}
                  className="mt-2 w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm capitalize outline-none focus:border-blue-400"
                >
                  {RELATION_TO_YOU_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
                {panelRelationToUser.trim().toLowerCase() !==
                loadedRelationForPanel ? (
                  <div className="mt-2">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Note (optional)
                    </label>
                    <input
                      value={panelRelationNote}
                      onChange={(e) => setPanelRelationNote(e.target.value)}
                      placeholder="e.g. met at conference"
                      className="mt-1 w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Things to remember</label>
              <textarea
                value={panelNotes}
                onChange={(e) => setPanelNotes(e.target.value)}
                onBlur={() => void saveThingsToRememberWithHistory()}
                rows={5}
                className="mt-1 w-full resize-y border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setRememberHistoryOpen((v) => !v)}
              >
                <span className="text-xs uppercase tracking-wide text-gray-400">
                  Edit History
                </span>
                <span className="text-xs text-gray-400">
                  {rememberHistoryOpen ? '▾' : '▸'}
                </span>
              </button>
              {rememberHistoryOpen ? (
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                  {rememberHistory.length === 0 ? (
                    <p className="text-xs text-gray-400">No edits yet.</p>
                  ) : (
                    rememberHistory.map((entry) => {
                      const expanded = rememberExpandedIds[entry.id] === true
                      const isLong = entry.content.length > 220
                      return (
                        <div key={entry.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
                          <p
                            className="text-sm text-foreground whitespace-pre-wrap break-words"
                            style={
                              expanded
                                ? undefined
                                : {
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }
                            }
                          >
                            {entry.content}
                          </p>
                          {isLong ? (
                            <button
                              type="button"
                              className="mt-1 text-xs text-blue-500 hover:underline"
                              onClick={() =>
                                setRememberExpandedIds((prev) => ({
                                  ...prev,
                                  [entry.id]: !expanded,
                                }))
                              }
                            >
                              {expanded ? 'show less' : 'show more'}
                            </button>
                          ) : null}
                          <p className="mt-1 text-xs text-gray-400">
                            {formatRememberSavedAt(entry.saved_at)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              ) : null}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-400">Custom attributes</span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() =>
                    setPanelRows((r) => [...r, { key: '', value: '' }])
                  }
                >
                  + Add field
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {panelRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="w-[36%] border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
                      value={row.key}
                      onChange={(e) =>
                        setPanelRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, key: e.target.value } : x
                          )
                        )
                      }
                      onBlur={() => {
                        if (
                          JSON.stringify(
                            rowsToCustomAttributes(panelRows)
                          ) ===
                          JSON.stringify(
                            parseCustomAttributes(selectedPerson.custom_attributes)
                          )
                        ) {
                          return
                        }
                        void saveNodePatch(selectedPerson.id, {
                          custom_attributes: rowsToCustomAttributes(panelRows),
                        })
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      {isBirthdayKey(row.key) ? (
                        <>
                          <input
                            type="date"
                            className="w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
                            value={canonicalBirthday(row.value).canonical ?? ''}
                            onChange={(e) =>
                              setPanelRows((rows) =>
                                rows.map((x, j) =>
                                  j === i ? { ...x, value: e.target.value } : x
                                )
                              )
                            }
                            onBlur={() => {
                              if (
                                JSON.stringify(
                                  rowsToCustomAttributes(panelRows)
                                ) ===
                                JSON.stringify(
                                  parseCustomAttributes(selectedPerson.custom_attributes)
                                )
                              ) {
                                return
                              }
                              void saveNodePatch(selectedPerson.id, {
                                custom_attributes: rowsToCustomAttributes(panelRows),
                              })
                            }}
                          />
                          {canonicalBirthday(row.value).parseable &&
                          canonicalBirthday(row.value).canonical ? (
                            <p className="mt-1 text-xs text-zinc-500">
                              {formatBirthday(canonicalBirthday(row.value).canonical!)}
                              {birthdayAge(canonicalBirthday(row.value).canonical!) != null
                                ? ` · Age: ${birthdayAge(canonicalBirthday(row.value).canonical!)}`
                                : ''}
                            </p>
                          ) : row.value.trim() ? (
                            <p className="mt-1 text-xs text-amber-600">
                              ⚠ Unrecognised date format
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <input
                          className="w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
                          value={row.value}
                          onChange={(e) =>
                            setPanelRows((rows) =>
                              rows.map((x, j) =>
                                j === i ? { ...x, value: e.target.value } : x
                              )
                            )
                          }
                          onBlur={() => {
                            if (
                              JSON.stringify(
                                rowsToCustomAttributes(panelRows)
                              ) ===
                              JSON.stringify(
                                parseCustomAttributes(selectedPerson.custom_attributes)
                              )
                            ) {
                              return
                            }
                            void saveNodePatch(selectedPerson.id, {
                              custom_attributes: rowsToCustomAttributes(panelRows),
                            })
                          }}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-zinc-500"
                      onClick={() =>
                        setPanelRows((rows) =>
                          rows.filter((_, j) => j !== i).length === 0
                            ? [{ key: '', value: '' }]
                            : rows.filter((_, j) => j !== i)
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Communities</p>
              {selectedNodeCommunities.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-400">No communities yet</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedNodeCommunities.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                      style={{
                        color: c.color,
                        borderColor: c.color,
                        backgroundColor: hexToRgba(c.color, 0.15),
                      }}
                    >
                      <span>{c.name}</span>
                      <button
                        type="button"
                        className="text-[11px] leading-none"
                        onClick={() => void toggleNodeCommunityMembership(selectedPerson.id, c.id)}
                        aria-label={`Remove from ${c.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <select
                value={panelCommunityPicker}
                onChange={(e) => {
                  const cid = e.target.value
                  setPanelCommunityPicker('')
                  if (!cid) return
                  void toggleNodeCommunityMembership(selectedPerson.id, cid)
                }}
                className="mt-2 w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
              >
                <option value="">+ Add to community</option>
                {availableCommunitiesForSelectedNode.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {!selectedPerson.is_self ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Relationship history</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Changes to “relation to you”, newest first.
                </p>
                {relationHistory.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-400">
                    No changes recorded yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                    {relationHistory.map((row) => (
                      <li key={row.id} className="text-sm">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-medium capitalize">
                            → {row.new_relation}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatRelativeTime(row.changed_at)}
                          </span>
                        </div>
                        {row.previous_relation ? (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            was:{' '}
                            <span className="capitalize">
                              {row.previous_relation}
                            </span>
                          </p>
                        ) : null}
                        {row.note ? (
                          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                            {row.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Connections</p>
              <p className="text-xs text-zinc-500">Existing links for this person.</p>
              <ul className="mt-3 space-y-2 text-sm">
                {edgesForPersonDeduped(dbEdges, selectedPerson.id).map((e) => {
                  const oid =
                    e.source_node_id === selectedPerson.id
                      ? e.target_node_id
                      : e.source_node_id
                  const other = people.find((p) => p.id === oid)
                  return (
                    <li
                      key={pairKey(e.source_node_id, e.target_node_id)}
                      className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 dark:border-zinc-700"
                    >
                      <span className="font-medium">{other?.name ?? oid}</span>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-red-600 dark:text-red-400"
                        onClick={() => void removePanelConnection(oid)}
                      >
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            {panelErr ? (
              <p className="text-sm text-red-600" role="alert">
                {panelErr}
              </p>
            ) : null}
          </div>
          <div className="border-t p-3 dark:border-zinc-800 space-y-2">
            {panelSaveState === 'saved' ? (
              <p className="text-xs text-zinc-500 transition-opacity duration-300">
                Saved ✓
              </p>
            ) : null}
            {panelSaveState === 'error' ? (
              <p className="text-xs text-red-600">Failed to save</p>
            ) : null}
            {!selectedPerson.is_self ? (
              <button
                type="button"
                disabled={panelSaving}
                className="w-full rounded-md border border-red-200 py-1 text-sm text-red-700 dark:border-red-900 disabled:opacity-40"
                onClick={() => void deletePerson()}
              >
                Delete person
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}

      {photoLightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPhotoLightbox(null)}
        >
          <div
            className="max-w-[min(90vw,42rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photoLightbox.url}
              alt=""
              width={900}
              height={900}
              className="max-h-[70vh] w-auto rounded-lg object-contain"
              unoptimized
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background"
                onClick={() => void setMainPhoto(photoLightbox)}
              >
                Set as Main
              </button>
              <button
                type="button"
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
                onClick={() => void deletePhoto(photoLightbox)}
              >
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newCommunityOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-background p-6 shadow-xl dark:border-zinc-700"
            role="dialog"
            aria-labelledby="new-community-title"
          >
            <h3 id="new-community-title" className="font-semibold">
              New community
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Connections assigned to this group use this color on the graph.
            </p>
            <label htmlFor="new-comm-name" className="mt-4 block text-sm font-medium">
              Name
            </label>
            <input
              id="new-comm-name"
              value={newCommunityName}
              onChange={(e) => setNewCommunityName(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
              placeholder="e.g. Work, Family"
            />
            <label htmlFor="new-comm-color" className="mt-3 block text-sm font-medium">
              Color
            </label>
            <input
              id="new-comm-color"
              type="color"
              value={newCommunityColor}
              onChange={(e) => setNewCommunityColor(e.target.value)}
              className="mt-1 h-11 w-full cursor-pointer rounded-md border border-zinc-300 bg-background dark:border-zinc-600"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={creatingCommunity}
                className="flex-1 rounded-md bg-foreground py-2 text-sm font-medium text-background disabled:opacity-50"
                onClick={() => void createCommunityFromModal()}
              >
                {creatingCommunity ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setNewCommunityOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

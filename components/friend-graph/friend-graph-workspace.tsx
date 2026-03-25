'use client'

import { useToast } from '@/components/toast-provider'
import { CommunityConnectOverlay } from '@/components/friend-graph/community-connect-overlay'
import { CommunitiesLegend } from '@/components/friend-graph/communities-legend'
import { ConstellationNode } from '@/components/friend-graph/constellation-node'
import { LabeledEdge } from '@/components/friend-graph/labeled-edge'
import { PersonNode } from '@/components/friend-graph/person-node'
import { CONNECTION_LABEL_PRESETS } from '@/lib/connection-presets'
import { nodeIdsInCommunity } from '@/lib/community-members'
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
import { RELATION_TYPE_ORDER } from '@/lib/relation-type-colors'
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
  const [connEdgeLabel, setConnEdgeLabel] = useState('friends')

  const [communities, setCommunities] = useState<
    { id: string; name: string; owner_id: string; color: string }[]
  >([])
  const [graphHighlight, setGraphHighlight] = useState<GraphHighlightState>({
    kind: 'none',
  })
  /** Legend or edge: focused community (null = default graph). */
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null
  )

  const [connSearch, setConnSearch] = useState('')
  const [newConnOtherId, setNewConnOtherId] = useState('')
  const [newConnLabel, setNewConnLabel] = useState('')
  const [newConnCommunityId, setNewConnCommunityId] = useState<string | null>(
    null
  )
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
  const [panelRel, setPanelRel] = useState<RelationshipKind>('friend')
  const [panelNotes, setPanelNotes] = useState('')
  const [panelRows, setPanelRows] = useState<{ key: string; value: string }[]>(
    [{ key: '', value: '' }]
  )
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr, setPanelErr] = useState<string | null>(null)
  const [panelEditMode, setPanelEditMode] = useState<'view' | 'edit'>('view')
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

  const pinSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    return communityColorMap.get(selectedCommunityId) ?? DEFAULT_EDGE_NEUTRAL
  }, [selectedCommunityId, communityColorMap])

  /** Unordered pairs for dashed overlay lines (not stored in DB). */
  const communityOverlayPairs = useMemo(() => {
    if (!selectedCommunityId) return []
    const ids = [...nodeIdsInCommunity(dbEdges, selectedCommunityId)].sort()
    const pairs: { source: string; target: string }[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.push({ source: ids[i], target: ids[j] })
      }
    }
    return pairs
  }, [selectedCommunityId, dbEdges])

  const memberSetForCommunity = useMemo(() => {
    if (!selectedCommunityId) return null
    return nodeIdsInCommunity(dbEdges, selectedCommunityId)
  }, [selectedCommunityId, dbEdges])

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
        },
      }
    })
  }, [initialNodes, memberSetForCommunity, selectedCommunityHex])

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

  const loadData = useCallback(async (): Promise<DbPerson[] | null> => {
    setLoading(true)
    setError(null)
    const [locsRes, nodesRes, edgesRes, commRes] = await Promise.all([
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
          'id,owner_id,source_node_id,target_node_id,label,community_id,relation_type'
        )
        .eq('owner_id', userId),
      supabase
        .from('communities')
        .select('id,name,owner_id,color')
        .eq('owner_id', userId)
        .order('name'),
    ])
    const errs = [
      locsRes.error,
      nodesRes.error,
      edgesRes.error,
      commRes.error,
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
        return {
          id: e.id as string,
          source_node_id: e.source_node_id as string,
          target_node_id: e.target_node_id as string,
          label: String(e.label ?? 'friend'),
          community_id:
            cid == null || cid === ''
              ? null
              : String(cid),
          relation_type:
            rt == null || rt === ''
              ? null
              : String(rt).trim().toLowerCase(),
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

  useEffect(() => {
    if (!selectedPerson) {
      setPanelLocId('')
      setPanelRel('friend')
      setPanelNotes('')
      setPanelRows([{ key: '', value: '' }])
      setConnSearch('')
      setNewConnOtherId('')
      setNewConnLabel('')
      setPanelRelationToUser('other')
      setPanelRelationNote('')
      setPanelName('')
      setPanelEditMode('view')
      return
    }
    setPanelName(selectedPerson.name)
    setPanelEditMode('view')
    setPanelLocId(selectedPerson.location_id ?? '')
    setPanelRel(
      RELATIONSHIP_VALUES.includes(selectedPerson.relationship as RelationshipKind)
        ? (selectedPerson.relationship as RelationshipKind)
        : 'friend'
    )
    setPanelNotes(selectedPerson.things_to_remember)
    setPanelRows(
      customAttributesToRows(parseCustomAttributes(selectedPerson.custom_attributes))
    )
    setPanelErr(null)
    setConnSearch('')
    setNewConnOtherId('')
    setNewConnLabel('')
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

  const cancelPanelEdit = useCallback(() => {
    if (!selectedPerson) return
    setPanelName(selectedPerson.name)
    setPanelLocId(selectedPerson.location_id ?? '')
    setPanelRel(
      RELATIONSHIP_VALUES.includes(selectedPerson.relationship as RelationshipKind)
        ? (selectedPerson.relationship as RelationshipKind)
        : 'friend'
    )
    setPanelNotes(selectedPerson.things_to_remember)
    setPanelRows(
      customAttributesToRows(parseCustomAttributes(selectedPerson.custom_attributes))
    )
    setPanelRelationToUser(loadedRelationForPanel)
    setPanelRelationNote('')
    setPanelErr(null)
    setPanelEditMode('view')
  }, [selectedPerson, loadedRelationForPanel])

  const savePanel = useCallback(async () => {
    if (!selectedPerson) return
    const nameTrim = panelName.trim()
    if (!nameTrim) {
      setPanelErr('Name is required.')
      return
    }
    setPanelSaving(true)
    setPanelErr(null)
    const custom = rowsToCustomAttributes(panelRows)
    const locChanged =
      (panelLocId || null) !== (selectedPerson.location_id ?? null)
    let pos: { x: number; y: number } | undefined
    if (locChanged && panelLocId) {
      const group = people.filter(
        (p) => p.location_id === panelLocId && p.id !== selectedPerson.id
      )
      pos = scatterPersonInGroup(group.length, group.length + 1)
    }
    if (locChanged && !panelLocId) {
      pos = scatterPersonInGroup(0, 1)
    }

    const selfRow = people.find((p) => p.is_self)
    const sid = selfRow?.id

    const nodeUpdate: Record<string, unknown> = {
      name: nameTrim,
      location_id: panelLocId || null,
      relationship: panelRel,
      things_to_remember: panelNotes,
      custom_attributes: custom,
    }
    if (pos) {
      nodeUpdate.position_x = pos.x
      nodeUpdate.position_y = pos.y
    }
    if (locChanged) {
      nodeUpdate.pos_x = null
      nodeUpdate.pos_y = null
    }

    const { error: uerr } = await supabase
      .from('nodes')
      .update(nodeUpdate)
      .eq('id', selectedPerson.id)
      .eq('owner_id', userId)
    if (uerr) {
      setPanelSaving(false)
      setPanelErr(uerr.message)
      return
    }

    if (!selectedPerson.is_self && sid) {
      const canonical = dedupeEdgesForGraph(dbEdges)
      const edgePair = canonical.find(
        (e) =>
          pairKey(e.source_node_id, e.target_node_id) ===
          pairKey(sid, selectedPerson.id)
      )
      const prevNorm =
        edgePair?.relation_type?.trim().toLowerCase() ?? 'other'
      const nextNorm = panelRelationToUser.trim().toLowerCase()
      const noteTrim = panelRelationNote.trim()

      const shouldChangeRelation =
        prevNorm !== nextNorm && (edgePair != null || nextNorm !== 'other')

      if (shouldChangeRelation) {
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
            setPanelSaving(false)
            setPanelErr(insE.message)
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
            setPanelSaving(false)
            setPanelErr((e1 ?? e2)?.message ?? 'Edge update failed')
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
          setPanelSaving(false)
          setPanelErr(histE.message)
          return
        }
      }
    }

    const savedId = selectedPerson.id
    setPanelSaving(false)
    setPanelRelationNote('')
    const nextPeople = await loadData()
    setPanelEditMode('view')
    if (nextPeople) {
      const p = nextPeople.find((x) => x.id === savedId)
      if (p) {
        setSelectedPerson(p)
        setPanelName(p.name)
      }
    }
  }, [
    selectedPerson,
    panelName,
    panelLocId,
    panelRel,
    panelNotes,
    panelRows,
    panelRelationToUser,
    panelRelationNote,
    people,
    dbEdges,
    supabase,
    userId,
    loadData,
  ])

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

  const addPanelConnection = useCallback(async () => {
    if (!selectedPerson || !newConnOtherId) return
    const label = newConnLabel.trim() || 'connected'
    const dup = dbEdges.some(
      (e) =>
        pairKey(e.source_node_id, e.target_node_id) ===
        pairKey(selectedPerson.id, newConnOtherId)
    )
    if (dup) {
      setPanelErr('You already have a connection with this person.')
      return
    }
    setPanelErr(null)
    const cid = newConnCommunityId || null
    const { error: e } = await supabase.from('edges').insert([
      {
        owner_id: userId,
        source_node_id: selectedPerson.id,
        target_node_id: newConnOtherId,
        label,
        community_id: cid,
      },
      {
        owner_id: userId,
        source_node_id: newConnOtherId,
        target_node_id: selectedPerson.id,
        label,
        community_id: cid,
      },
    ])
    if (e) {
      setPanelErr(e.message)
      return
    }
    setNewConnOtherId('')
    setNewConnLabel('')
    setNewConnCommunityId(null)
    await loadData()
  }, [
    selectedPerson,
    newConnOtherId,
    newConnLabel,
    newConnCommunityId,
    dbEdges,
    supabase,
    userId,
    loadData,
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

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!selectedPerson) return
      if (!NODE_IMAGE_TYPES.includes(file.type as (typeof NODE_IMAGE_TYPES)[number])) {
        showToast('Please choose a JPEG, PNG, or WebP image.', 'error')
        return
      }
      const personId = selectedPerson.id
      const ext = mimeToNodeExt(file.type)
      const path = `${userId}/${personId}/${Date.now()}.${ext}`
      const prevUrl = selectedPerson.avatar_url

      const blobUrl = URL.createObjectURL(file)
      patchPersonAvatar(personId, blobUrl)

      setAvatarUploading(true)
      setPanelErr(null)

      const { error: upErr } = await supabase.storage
        .from('node-avatars')
        .upload(path, file, { upsert: false, cacheControl: '3600' })

      if (upErr) {
        URL.revokeObjectURL(blobUrl)
        patchPersonAvatar(personId, prevUrl)
        setAvatarUploading(false)
        showToast(upErr.message, 'error')
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('node-avatars').getPublicUrl(path)

      const { error: uerr } = await supabase
        .from('nodes')
        .update({ avatar_url: publicUrl })
        .eq('id', personId)
        .eq('owner_id', userId)

      URL.revokeObjectURL(blobUrl)
      setAvatarUploading(false)

      if (uerr) {
        patchPersonAvatar(personId, prevUrl)
        showToast(uerr.message, 'error')
        return
      }

      patchPersonAvatar(personId, publicUrl)
      showToast('Photo updated.', 'success')
    },
    [
      selectedPerson,
      supabase,
      userId,
      patchPersonAvatar,
      showToast,
    ]
  )

  const removeAvatar = useCallback(async () => {
    if (!selectedPerson) return
    const personId = selectedPerson.id
    const prevUrl = selectedPerson.avatar_url

    patchPersonAvatar(personId, null)
    setAvatarUploading(true)
    setPanelErr(null)

    const prefix = `${userId}/${personId}`
    const { data: list } = await supabase.storage
      .from('node-avatars')
      .list(prefix)
    if (list?.length) {
      await supabase.storage.from('node-avatars').remove(
        list.map((o) => `${prefix}/${o.name}`)
      )
    }
    const { error: uerr } = await supabase
      .from('nodes')
      .update({ avatar_url: null })
      .eq('id', personId)
      .eq('owner_id', userId)

    setAvatarUploading(false)

    if (uerr) {
      patchPersonAvatar(personId, prevUrl)
      showToast(uerr.message, 'error')
      return
    }

    showToast('Photo removed.', 'success')
  }, [selectedPerson, supabase, userId, patchPersonAvatar, showToast])

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
    const label = connEdgeLabel.trim() || 'connected'
    const cid = pendingCommunityId || null
    const { error: e } = await supabase.from('edges').insert([
      {
        owner_id: userId,
        source_node_id: pendingConn.source,
        target_node_id: pendingConn.target,
        label,
        community_id: cid,
      },
      {
        owner_id: userId,
        source_node_id: pendingConn.target,
        target_node_id: pendingConn.source,
        label,
        community_id: cid,
      },
    ])
    if (e) setError(e.message)
    setPendingConn(null)
    setPendingCommunityId(null)
    await loadData()
  }, [
    pendingConn,
    pendingCommunityId,
    dbEdges,
    supabase,
    userId,
    connEdgeLabel,
    loadData,
  ])

  const saveEdgeLabel = useCallback(async () => {
    if (!selectedEdge) return
    const raw = dbEdges.find((d) => d.id === selectedEdge.id)
    if (!raw) return
    const a = raw.source_node_id
    const b = raw.target_node_id
    const label = connEdgeLabel.trim() || 'connected'
    const cid = connEdgeCommunityId || null
    const { error: e1 } = await supabase
      .from('edges')
      .update({ label, community_id: cid })
      .eq('owner_id', userId)
      .eq('source_node_id', a)
      .eq('target_node_id', b)
    const { error: e2 } = await supabase
      .from('edges')
      .update({ label, community_id: cid })
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
    connEdgeLabel,
    connEdgeCommunityId,
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
    setConnEdgeLabel('friends')
    setPendingCommunityId(null)
    setPendingConn({ source: c.source, target: c.target })
  }, [])

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== 'person') return
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
    [people, schedulePersistPinnedPosition, supabase, userId, loadData]
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
          setSelectedCommunityId(null)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
          setSelectedEdge(null)
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
        }}
        onEdgeClick={(_, e) => {
          setSelectedPerson(null)
          setEdges((eds) =>
            eds.map((edge) => ({ ...edge, selected: edge.id === e.id }))
          )
          setSelectedEdge(e)
          const raw = dbEdges.find((d) => d.id === e.id)
          setConnEdgeLabel(raw?.label ?? '')
          setConnEdgeCommunityId(raw?.community_id ?? null)
          const d = e.data as { communityKey?: string }
          const key = d?.communityKey ?? NO_COMMUNITY_KEY
          setSelectedCommunityId(key)
          setGraphHighlight({ kind: 'none' })
        }}
        onNodeDragStop={onNodeDragStop}
        fitView
        minZoom={0.35}
        maxZoom={1.4}
        className="touch-none h-full w-full bg-zinc-50/50 dark:bg-zinc-950/40"
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
        onPickCommunity={(key) => {
          if (selectedCommunityId === key) {
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
          setSelectedCommunityId(key)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
          setSelectedEdge(null)
          setConnEdgeCommunityId(null)
          setEdges((eds) =>
            eds.map((edge) => ({ ...edge, selected: false }))
          )
        }}
        onNewCommunity={() => {
          setNewCommunityName('')
          setNewCommunityColor('#FF6B6B')
          setNewCommunityOpen(true)
        }}
      />
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

      {pendingConn ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-background p-6 dark:border-zinc-700">
            <h3 className="font-semibold">New connection</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Describe how they&apos;re connected (saved both ways).
            </p>
            <input
              value={connEdgeLabel}
              onChange={(e) => setConnEdgeLabel(e.target.value)}
              className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
              placeholder="e.g. coworkers, siblings"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {CONNECTION_LABEL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] dark:border-zinc-600"
                  onClick={() => setConnEdgeLabel(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-medium">Community (optional)</label>
            <select
              value={pendingCommunityId ?? ''}
              onChange={(e) =>
                setPendingCommunityId(e.target.value || null)
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
          <p className="mt-1 text-xs text-zinc-500">
            The label on the line is the relationship between the two people.
          </p>
          <input
            value={connEdgeLabel}
            onChange={(e) => setConnEdgeLabel(e.target.value)}
            className="mt-2 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
            placeholder="Relationship label"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {CONNECTION_LABEL_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="rounded-full border px-2 py-0.5 text-[11px] dark:border-zinc-600"
                onClick={() => setConnEdgeLabel(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm font-medium">Community (optional)</label>
          <select
            value={connEdgeCommunityId ?? ''}
            onChange={(e) =>
              setConnEdgeCommunityId(e.target.value || null)
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
        <aside className="fixed right-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-background shadow-2xl dark:border-zinc-800">
          <div className="border-b p-4 dark:border-zinc-800">
            <div className="flex justify-end">
              <button
                type="button"
                className="text-2xl leading-none text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                onClick={() => {
                  setSelectedCommunityId(null)
                  setGraphHighlight({ kind: 'none' })
                  setPanelEditMode('view')
                  setSelectedPerson(null)
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mt-1 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
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
                      {personDisplayInitial(
                        panelEditMode === 'edit'
                          ? panelName
                          : selectedPerson.name
                      )}
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
                  {panelEditMode === 'edit' ? (
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
                          if (f) void uploadAvatar(f)
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                {panelEditMode === 'edit' ? (
                  <input
                    value={panelName}
                    onChange={(e) => setPanelName(e.target.value)}
                    aria-label="Name"
                    className="mt-0.5 w-full min-h-[2.5rem] rounded-md border border-zinc-300 bg-background px-3 py-2 text-xl font-bold text-foreground outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-zinc-600"
                  />
                ) : (
                  <h2 className="min-h-[2.5rem] px-1 text-xl font-bold leading-snug text-foreground">
                    {selectedPerson.name.trim() || 'Unnamed'}
                  </h2>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  Your relationship to them (category)
                </p>
                {panelEditMode === 'edit' && selectedPerson.avatar_url ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-red-600 underline dark:text-red-400"
                    disabled={avatarUploading}
                    onClick={() => void removeAvatar()}
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Location</label>
              <select
                value={panelLocId}
                onChange={(e) => setPanelLocId(e.target.value)}
                disabled={panelEditMode === 'view'}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-80 dark:border-zinc-600 dark:disabled:bg-zinc-900/60"
              >
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium">Relationship</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RELATIONSHIP_VALUES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={panelEditMode === 'view'}
                    onClick={() => setPanelRel(r)}
                    className={`rounded-full px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70 ${
                      panelRel === r
                        ? 'bg-violet-600 text-white'
                        : 'border border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {relationshipTitle(r)}
                  </button>
                ))}
              </div>
            </div>
            {!selectedPerson.is_self ? (
              <div>
                <label className="text-sm font-medium">
                  Relation to you (edge)
                </label>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Controls the ring colour on the graph (how they connect to{' '}
                  <span className="font-medium">You</span>). Saved with{' '}
                  <span className="font-medium">Save changes</span>.
                </p>
                <select
                  value={panelRelationToUser}
                  onChange={(e) => setPanelRelationToUser(e.target.value)}
                  disabled={panelEditMode === 'view'}
                  className="mt-2 w-full rounded-md border px-3 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-80 dark:border-zinc-600 dark:disabled:bg-zinc-900/60"
                >
                  {RELATION_TYPE_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {r}
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
                      disabled={panelEditMode === 'view'}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-80 dark:border-zinc-600 dark:disabled:bg-zinc-900/60"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="text-sm font-medium">Things to remember</label>
              <textarea
                value={panelNotes}
                onChange={(e) => setPanelNotes(e.target.value)}
                rows={5}
                readOnly={panelEditMode === 'view'}
                className="mt-1 w-full resize-y rounded-md border px-3 py-2 text-sm read-only:cursor-default read-only:bg-zinc-50 read-only:opacity-90 dark:border-zinc-600 dark:read-only:bg-zinc-900/40"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Custom attributes</span>
                <button
                  type="button"
                  disabled={panelEditMode === 'view'}
                  className="text-xs underline disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="w-[36%] rounded-md border px-2 py-1 text-sm read-only:bg-zinc-50 dark:border-zinc-600 dark:read-only:bg-zinc-900/40"
                      value={row.key}
                      readOnly={panelEditMode === 'view'}
                      onChange={(e) =>
                        setPanelRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, key: e.target.value } : x
                          )
                        )
                      }
                    />
                    <input
                      className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm read-only:bg-zinc-50 dark:border-zinc-600 dark:read-only:bg-zinc-900/40"
                      value={row.value}
                      readOnly={panelEditMode === 'view'}
                      onChange={(e) =>
                        setPanelRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, value: e.target.value } : x
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className="text-zinc-500 disabled:opacity-40"
                      disabled={panelEditMode === 'view'}
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
            {!selectedPerson.is_self ? (
              <div>
                <p className="text-sm font-medium">Relationship history</p>
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
              <p className="text-sm font-medium">Connections</p>
              <p className="text-xs text-zinc-500">
                Links to other people (bidirectional, same label both ways). Edge
                labels on the canvas show names; relationship note appears in the
                tooltip.
              </p>
              <input
                value={connSearch}
                onChange={(e) => setConnSearch(e.target.value)}
                placeholder="Search people…"
                readOnly={panelEditMode === 'view'}
                className="mt-2 w-full rounded-md border px-3 py-1.5 text-sm read-only:bg-zinc-50 dark:border-zinc-600 dark:read-only:bg-zinc-900/40"
              />
              <select
                value={newConnOtherId}
                onChange={(e) => setNewConnOtherId(e.target.value)}
                disabled={panelEditMode === 'view'}
                className="mt-2 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-80 dark:border-zinc-600 dark:disabled:bg-zinc-900/60"
              >
                <option value="">Select a person…</option>
                {people
                  .filter(
                    (p) =>
                      p.id !== selectedPerson.id &&
                      p.name
                        .toLowerCase()
                        .includes(connSearch.trim().toLowerCase())
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <input
                value={newConnLabel}
                onChange={(e) => setNewConnLabel(e.target.value)}
                placeholder="Relationship (e.g. childhood friends)"
                readOnly={panelEditMode === 'view'}
                className="mt-2 w-full rounded-md border px-3 py-1.5 text-sm read-only:bg-zinc-50 dark:border-zinc-600 dark:read-only:bg-zinc-900/40"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {CONNECTION_LABEL_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={panelEditMode === 'view'}
                    className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] disabled:opacity-50 dark:border-zinc-600"
                    onClick={() => setNewConnLabel(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <label className="mt-2 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Community (optional)
              </label>
              <select
                value={newConnCommunityId ?? ''}
                onChange={(e) =>
                  setNewConnCommunityId(e.target.value || null)
                }
                disabled={panelEditMode === 'view'}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-80 dark:border-zinc-600 dark:disabled:bg-zinc-900/60"
              >
                <option value="">No community</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={panelEditMode === 'view'}
                className="mt-2 w-full rounded-md border border-zinc-300 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600"
                onClick={() => void addPanelConnection()}
              >
                Add connection
              </button>
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
                      <span className="max-w-[40%] truncate text-xs text-zinc-500">
                        {e.label}
                      </span>
                      <button
                        type="button"
                        disabled={panelEditMode === 'view'}
                        className="shrink-0 text-xs text-red-600 disabled:opacity-40 dark:text-red-400"
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
          <div className="border-t p-4 dark:border-zinc-800 space-y-2">
            {panelEditMode === 'view' ? (
              <>
                <button
                  type="button"
                  className="w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-background"
                  onClick={() => setPanelEditMode('edit')}
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  disabled={panelSaving || selectedPerson.is_self}
                  className="w-full rounded-md border border-red-200 py-2 text-sm text-red-700 dark:border-red-900 disabled:opacity-40"
                  onClick={() => void deletePerson()}
                >
                  Delete person
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={panelSaving}
                  className="w-full rounded-md bg-foreground py-2.5 text-sm text-background disabled:opacity-50"
                  onClick={() => void savePanel()}
                >
                  {panelSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  disabled={panelSaving}
                  className="w-full rounded-md border border-zinc-300 py-2 text-sm dark:border-zinc-600"
                  onClick={() => cancelPanelEdit()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={panelSaving || selectedPerson.is_self}
                  className="w-full rounded-md border border-red-200 py-2 text-sm text-red-700 dark:border-red-900 disabled:opacity-40"
                  onClick={() => void deletePerson()}
                >
                  Delete person
                </button>
              </>
            )}
          </div>
        </aside>
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

'use client'

import { useToast } from '@/components/toast-provider'
import { CommunityConnectOverlay } from '@/components/friend-graph/community-connect-overlay'
import { CommunitiesLegend } from '@/components/friend-graph/communities-legend'
import { ConstellationOverlay } from '@/components/friend-graph/constellation-overlay'
import { LabeledEdge } from '@/components/friend-graph/labeled-edge'
import { NodeDetailPanel } from '@/components/friend-graph/node-detail-panel'
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

const nodeTypes = { person: PersonNode }
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
const RELATION_TYPES = [
  'Friend',
  'Close Friend',
  'Ex-Friend',
  'Family',
  'Partner',
  'Ex-Partner',
  'Colleague',
  'Mentor',
  'Mentee',
  'Acquaintance',
  'Neighbour',
  'Classmate',
  'Enemy',
  'Other',
] as const
function legacyTagToRelationTypeLegacyField(tag: string | null): string | null {
  if (!tag) return null
  return tag.trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeRelationTags(tags: string[]): string[] {
  const allowed = new Set<string>(RELATION_TYPES as unknown as string[])
  const cleaned = tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t) => allowed.has(t))
  const uniq = Array.from(new Set(cleaned))
  const order = new Map<string, number>(
    (RELATION_TYPES as unknown as string[]).map((t, i) => [t, i])
  )
  uniq.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
  return uniq
}

function legacyRelationTypeToTags(rt: string | null | undefined): string[] {
  const t = (rt ?? '').trim().toLowerCase()
  if (!t) return []
  if (t === 'friend') return ['Friend']
  if (t === 'family') return ['Family']
  if (t === 'partner') return ['Partner']
  if (t === 'colleague') return ['Colleague']
  if (t === 'mentor') return ['Mentor']
  if (t === 'mentee') return ['Mentee']
  if (t === 'acquaintance') return ['Acquaintance']
  if (t === 'neighbour') return ['Neighbour']
  if (t === 'classmate') return ['Classmate']
  if (t === 'enemy') return ['Enemy']
  if (t === 'other') return ['Other']
  return ['Other']
}

function relationTagPillClass(tag: string): string {
  const t = tag.trim()
  const base = 'rounded-full px-2 py-0.5 text-[11px] font-medium border'
  if (t === 'Friend' || t === 'Close Friend')
    return `${base} border-yellow-200 bg-yellow-100 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-200`
  if (t === 'Ex-Friend' || t === 'Ex-Partner')
    return `${base} border-orange-200 bg-orange-100 text-orange-900 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-200`
  if (t === 'Family')
    return `${base} border-red-200 bg-red-100 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200`
  if (t === 'Partner')
    return `${base} border-pink-200 bg-pink-100 text-pink-900 dark:border-pink-900/50 dark:bg-pink-900/20 dark:text-pink-200`
  if (t === 'Colleague' || t === 'Mentee')
    return `${base} border-purple-200 bg-purple-100 text-purple-900 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-200`
  if (t === 'Mentor')
    return `${base} border-green-200 bg-green-100 text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200`
  if (t === 'Acquaintance')
    return `${base} border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-200`
  if (t === 'Neighbour' || t === 'Classmate')
    return `${base} border-teal-200 bg-teal-100 text-teal-900 dark:border-teal-900/50 dark:bg-teal-900/20 dark:text-teal-200`
  if (t === 'Enemy')
    return `${base} border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200`
  return `${base} border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`
}

function relationTagPickerClass(selected: boolean): string {
  return [
    'rounded-full px-2 py-1 text-xs transition-colors',
    selected
      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
      : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900',
  ].join(' ')
}

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
  const [hoverCommunityId, setHoverCommunityId] = useState<string | null>(null)

  const [addConnectionOpen, setAddConnectionOpen] = useState(false)
  const [connectPersonAId, setConnectPersonAId] = useState('')
  const [connectPersonBId, setConnectPersonBId] = useState('')
  const [connectRelationTags, setConnectRelationTags] = useState<string[]>([])
  const [connectCommunityId, setConnectCommunityId] = useState<string | null>(null)
  const [connectNote, setConnectNote] = useState('')
  const [connectErr, setConnectErr] = useState<string | null>(null)
  const [panelCommunityPicker, setPanelCommunityPicker] = useState('')
  const [pendingRelationTags, setPendingRelationTags] = useState<string[]>([])
  const [pendingCommunityId, setPendingCommunityId] = useState<string | null>(null)
  const [pendingLabelNote, setPendingLabelNote] = useState('')

  const [selectedEdgeRelationTags, setSelectedEdgeRelationTags] = useState<string[]>([])
  const [selectedEdgeCommunityId, setSelectedEdgeCommunityId] = useState<string | null>(null)
  const [selectedEdgeLabel, setSelectedEdgeLabel] = useState('')
  const [newCommunityOpen, setNewCommunityOpen] = useState(false)
  const [newCommunityName, setNewCommunityName] = useState('')
  const [newCommunityColor, setNewCommunityColor] = useState('#FF6B6B')
  const [creatingCommunity, setCreatingCommunity] = useState(false)
  const [editCommunityOpen, setEditCommunityOpen] = useState(false)
  const [editCommunityId, setEditCommunityId] = useState<string | null>(null)
  const [editCommunityName, setEditCommunityName] = useState('')
  const [editCommunityColor, setEditCommunityColor] = useState('#FF6B6B')
  const [savingCommunityEdit, setSavingCommunityEdit] = useState(false)
  const [assignCommunityId, setAssignCommunityId] = useState<string | null>(null)
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    nodeId: string
    x: number
    y: number
  } | null>(null)
  const [locationLineTooltip, setLocationLineTooltip] = useState<{
    x: number
    y: number
    label: string
  } | null>(null)

  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const [panelLocId, setPanelLocId] = useState('')
  const [panelLocName, setPanelLocName] = useState('')
  const [panelNotes, setPanelNotes] = useState('')
  const [panelRows, setPanelRows] = useState<{ key: string; value: string }[]>(
    [{ key: '', value: '' }]
  )
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarPickerActive, setAvatarPickerActive] = useState(false)
  const [panelPhotos, setPanelPhotos] = useState<NodePhotoRow[]>([])
  const [photoLightbox, setPhotoLightbox] = useState<NodePhotoRow | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr, setPanelErr] = useState<string | null>(null)
  const [panelSaveState, setPanelSaveState] = useState<'idle' | 'saved' | 'error'>(
    'idle'
  )
  const [panelName, setPanelName] = useState('')
  const [panelRelationTags, setPanelRelationTags] = useState<string[]>([])
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

  const loadedRelationTagsForPanel = useMemo(() => {
    if (!selectedPerson || selectedPerson.is_self || !selfNodeId) return [] as string[]
    const edgePair = dedupeEdgesForGraph(dbEdges).find(
      (e) =>
        pairKey(e.source_node_id, e.target_node_id) ===
        pairKey(selfNodeId, selectedPerson.id)
    )
    const tagsRaw = (edgePair as any)?.relation_types
    if (Array.isArray(tagsRaw)) return normalizeRelationTags(tagsRaw as string[])
    const legacy = legacyRelationTypeToTags(edgePair?.relation_type ?? null)
    return normalizeRelationTags(legacy)
  }, [selectedPerson, selfNodeId, dbEdges])

  const loadedRelationTagsKey = useMemo(
    () => loadedRelationTagsForPanel.join(', '),
    [loadedRelationTagsForPanel]
  )

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

  const activeConstellationId = useMemo(() => {
    const key = hoverCommunityId ?? selectedCommunityId
    return key
  }, [hoverCommunityId, selectedCommunityId])

  const activeConstellationHex = useMemo(() => {
    if (!activeConstellationId) return DEFAULT_EDGE_NEUTRAL
    if (activeConstellationId === NO_COMMUNITY_KEY) return DEFAULT_EDGE_NEUTRAL
    const cid = normalizeCommunityId(activeConstellationId)
    return (cid ? communityColorMap.get(cid) : null) ?? DEFAULT_EDGE_NEUTRAL
  }, [activeConstellationId, communityColorMap])

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

  const locationOverlayPairs = useMemo(() => {
    const groups = new Map<string, DbPerson[]>()
    for (const p of people) {
      const locName = locations.find((l) => l.id === p.location_id)?.name ?? ''
      const key = locName.trim().toLowerCase()
      if (!key) continue
      const arr = groups.get(key) ?? []
      arr.push(p)
      groups.set(key, arr)
    }
    const pairs: { source: string; target: string; label: string }[] = []
    for (const [key, members] of groups.entries()) {
      if (members.length < 2) continue
      const sorted = [...members].sort((a, b) => {
        const at = a.created_at ? Date.parse(a.created_at) : Number.MAX_SAFE_INTEGER
        const bt = b.created_at ? Date.parse(b.created_at) : Number.MAX_SAFE_INTEGER
        return at - bt || a.id.localeCompare(b.id)
      })
      const label = sorted[0]?.location_id
        ? locations.find((l) => l.id === sorted[0].location_id)?.name ?? key
        : key
      for (let i = 0; i < sorted.length - 1; i++) {
        pairs.push({ source: sorted[i].id, target: sorted[i + 1].id, label })
      }
    }
    return pairs
  }, [people, locations])

  const memberSetForConstellation = useMemo(() => {
    if (!activeConstellationId) return null
    if (activeConstellationId === NO_COMMUNITY_KEY) {
      const out = new Set<string>()
      for (const p of people) {
        const ids = nodeCommunityMap.get(p.id) ?? []
        if (ids.length === 0) out.add(p.id)
      }
      return out
    }
    const sid = normalizeCommunityId(activeConstellationId)
    if (!sid) return new Set<string>()
    const out = new Set<string>()
    for (const [nid, cids] of nodeCommunityMap.entries()) {
      if (cids.includes(sid)) out.add(nid)
    }
    return out
  }, [activeConstellationId, nodeCommunityMap, people])

  const constellationMode = Boolean(
    activeConstellationId && activeConstellationId !== NO_COMMUNITY_KEY
  )

  const constellationMemberIds = useMemo(
    () => (memberSetForConstellation ? [...memberSetForConstellation] : []),
    [memberSetForConstellation]
  )

  const constellationPairs = useMemo(() => {
    if (!constellationMode) return []
    const ids = constellationMemberIds
    if (ids.length < 2) return []
    // Full "star map" mesh for small constellations; fall back to chain for large.
    if (ids.length <= 18) {
      const pairs: { source: string; target: string }[] = []
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          pairs.push({ source: ids[i]!, target: ids[j]! })
        }
      }
      return pairs
    }
    const sorted = [...ids].sort((a, b) => a.localeCompare(b))
    const pairs: { source: string; target: string }[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      pairs.push({ source: sorted[i]!, target: sorted[i + 1]! })
    }
    return pairs
  }, [constellationMode, constellationMemberIds])

  const communityHighlightOpts = useMemo(() => {
    if (!activeConstellationId) return null
    return {
      selectedCommunityId: activeConstellationId,
      selectedCommunityHex: activeConstellationHex,
    }
  }, [activeConstellationId, activeConstellationHex])

  const nodesForFlow = useMemo(() => {
    if (!memberSetForConstellation) return initialNodes
    const glowHex = activeConstellationHex
    return initialNodes.map((n) => {
      if (n.type !== 'person') return n
      const inSet = memberSetForConstellation.has(n.id)
      const baseData = (n.data ?? {}) as Record<string, unknown>
      const memberCommunityIds = nodeCommunityMap.get(n.id) ?? []
      const memberDots = memberCommunityIds
        .map((cid) => communityColorMap.get(cid))
        .filter((hex): hex is string => typeof hex === 'string' && hex.length > 0)
      return {
        ...n,
        style: {
          ...n.style,
          opacity: inSet ? 1 : constellationMode ? 0.08 : 0.15,
          transition: 'opacity 0.28s ease',
        },
        data: {
          ...baseData,
          communityMemberGlowHex: inSet ? glowHex : null,
          constellationMode,
          communityColorDots: memberDots,
        },
      }
    })
  }, [
    initialNodes,
    memberSetForConstellation,
    activeConstellationHex,
    constellationMode,
    nodeCommunityMap,
    communityColorMap,
  ])

  const styledEdges = useMemo(
    () =>
      applyGraphEdgeHighlights(
        baseFlowEdges,
        graphHighlight,
        selectedEdge?.id ?? null,
        communityHighlightOpts,
        { starMapMode: constellationMode }
      ),
    [baseFlowEdges, graphHighlight, selectedEdge?.id, communityHighlightOpts, constellationMode]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesForFlow)
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges)

  const clearTransientConnectionPreview = useCallback(() => {
    // Drop any ad-hoc edge objects that are not backed by DB edge data.
    setEdges((prev) =>
      prev.filter((edge) => {
        const d = edge.data as Record<string, unknown> | undefined
        return typeof d?.communityKey === 'string'
      })
    )
  }, [setEdges])

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
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return nodesForFlow.map((n) => {
        const withShift =
          n.type === 'person'
            ? {
                ...n,
                data: {
                  ...(n.data as Record<string, unknown>),
                  shiftConnect: sh,
                },
              }
            : n
        const existing = prevById.get(n.id)
        // Do not reset coordinates during pane/selection clicks.
        // Position updates should come from drag interactions + persistence flow.
        if (!existing) return withShift
        return {
          ...withShift,
          position: existing.position,
        }
      })
    })
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
          'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,pos_x,pos_y,avatar_url,is_self,created_at'
        )
        .eq('owner_id', userId),
      supabase
        .from('edges')
        .select(
          'id,owner_id,source_node_id,target_node_id,label,community_id,relation_type,relation_types,created_at'
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
            'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,pos_x,pos_y,avatar_url,is_self,created_at'
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
      created_at: r.created_at ? String(r.created_at) : null,
    }))
    setPeople(peopleList)
    setDbEdges(
      (edgesRes.data ?? []).map((e) => {
        const row = e as Record<string, unknown>
        const cid = row.community_id
        const rt = row.relation_type
        const rts = (row as any).relation_types
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
          relation_types: Array.isArray(rts)
            ? (rts as unknown[]).map((x) => String(x)).filter(Boolean)
            : null,
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
      setPanelLocName('')
      setPanelNotes('')
      setPanelRows([{ key: '', value: '' }])
      setPanelRelationTags([])
      setPanelRelationNote('')
      setPanelName('')
      return
    }
    setPanelName(selectedPerson.name)
    setPanelLocId(selectedPerson.location_id ?? '')
    setPanelLocName(
      locations.find((l) => l.id === selectedPerson.location_id)?.name ?? ''
    )
    setPanelNotes(selectedPerson.things_to_remember)
    setPanelRows(
      customAttributesToRows(parseCustomAttributes(selectedPerson.custom_attributes))
    )
    setPanelErr(null)
    setPanelCommunityPicker('')
    if (selectedPerson.is_self) {
      setPanelRelationTags([])
      setPanelRelationNote('')
    }
  }, [selectedPerson, locations])

  useEffect(() => {
    if (!selectedPerson) setAvatarPickerActive(false)
  }, [selectedPerson])

  useEffect(() => {
    if (!selectedEdge) {
      setSelectedEdgeRelationTags([])
      setSelectedEdgeCommunityId(null)
      setSelectedEdgeLabel('')
      return
    }
    const raw = dbEdges.find((d) => d.id === selectedEdge.id)
    if (!raw) return
    const tags =
      Array.isArray((raw as any).relation_types) && (raw as any).relation_types?.length
        ? normalizeRelationTags(((raw as any).relation_types as string[]) ?? [])
        : []
    setSelectedEdgeRelationTags(tags)
    setSelectedEdgeCommunityId(normalizeCommunityId(raw.community_id))
    setSelectedEdgeLabel(raw.label ?? '')
  }, [selectedEdge, dbEdges])

  useEffect(() => {
    if (!selectedPerson || selectedPerson.is_self) return
    setPanelRelationTags(loadedRelationTagsForPanel)
  }, [selectedPerson, selectedPerson?.is_self, loadedRelationTagsForPanel])

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

  const saveRelationTagsToUser = useCallback(
    async (nextTagsRaw: string[]) => {
      if (!selectedPerson || selectedPerson.is_self) return
      const selfRow = people.find((p) => p.is_self)
      const sid = selfRow?.id
      if (!sid) return

      const nextTags = normalizeRelationTags(nextTagsRaw)
      const noteTrim = panelRelationNote.trim()

      const aToB = dbEdges.find(
        (e) => e.source_node_id === sid && e.target_node_id === selectedPerson.id
      )
      const bToA = dbEdges.find(
        (e) => e.source_node_id === selectedPerson.id && e.target_node_id === sid
      )
      const prevFromEdge =
        Array.isArray((aToB as any)?.relation_types) && (aToB as any).relation_types?.length
          ? normalizeRelationTags(((aToB as any).relation_types as string[]) ?? [])
          : legacyRelationTypeToTags(aToB?.relation_type ?? null)
      const prevTags = normalizeRelationTags(prevFromEdge)

      const prevKey = prevTags.join(', ')
      const nextKey = nextTags.join(', ')
      if (prevKey === nextKey) return

      // Keep legacy single field populated for compatibility (first tag only).
      const legacyTag = nextTags[0] ?? null
      const legacyNorm =
        legacyTag == null
          ? null
          : legacyTag.trim().toLowerCase().replace(/\s+/g, '_')

      if (!aToB || !bToA) {
        // Only create an edge pair when there's something to store.
        if (nextTags.length === 0) return
        const { error: insE } = await supabase.from('edges').insert([
          {
            owner_id: userId,
            source_node_id: sid,
            target_node_id: selectedPerson.id,
            label: 'connected',
            community_id: null,
            relation_type: legacyNorm,
            relation_types: nextTags,
          },
          {
            owner_id: userId,
            source_node_id: selectedPerson.id,
            target_node_id: sid,
            label: 'connected',
            community_id: null,
            relation_type: legacyNorm,
            relation_types: nextTags,
          },
        ])
        if (insE) {
          markSaveFail(insE.message || 'Failed to save')
          return
        }
      } else {
        const { error: e1 } = await supabase
          .from('edges')
          .update({ relation_types: nextTags, relation_type: legacyNorm })
          .eq('owner_id', userId)
          .eq('id', aToB.id)
        const { error: e2 } = await supabase
          .from('edges')
          .update({ relation_types: nextTags, relation_type: legacyNorm })
          .eq('owner_id', userId)
          .eq('id', bToA.id)
        if (e1 || e2) {
          markSaveFail((e1 ?? e2)?.message ?? 'Failed to save')
          return
        }
      }

      const { error: histE } = await supabase.from('relation_history').insert({
        owner_id: userId,
        node_id: selectedPerson.id,
        previous_relation: prevKey.length ? prevKey : null,
        new_relation: nextKey.length ? nextKey : '',
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
    const relation_types = normalizeRelationTags(connectRelationTags)
    const legacy = legacyTagToRelationTypeLegacyField(relation_types[0] ?? null)
    const cid = normalizeCommunityId(connectCommunityId)
    const label = connectNote?.trim() || null
    const payload = [
      {
        owner_id: userId,
        source_node_id: personAId,
        target_node_id: personBId,
        relation_types,
        relation_type: legacy,
        community_id: cid,
        label,
      },
      {
        owner_id: userId,
        source_node_id: personBId,
        target_node_id: personAId,
        relation_types,
        relation_type: legacy,
        community_id: cid,
        label,
      },
    ]
    const { error: insErr } = await supabase.from('edges').insert(payload)
    if (insErr) {
      setConnectErr(insErr.message || 'Failed to add connection.')
      return
    }
    clearTransientConnectionPreview()
    setAddConnectionOpen(false)
    setConnectPersonAId('')
    setConnectPersonBId('')
    setConnectRelationTags([])
    setConnectCommunityId(null)
    setConnectNote('')
    await loadData()
    showToast('Connection added ✓', 'success')
  }, [
    connectPersonAId,
    connectPersonBId,
    connectRelationTags,
    connectCommunityId,
    connectNote,
    dbEdges,
    clearTransientConnectionPreview,
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

  const saveCommunityEdit = useCallback(async () => {
    const id = editCommunityId
    const name = editCommunityName.trim()
    const color = editCommunityColor
    if (!id) return
    if (!name) {
      showToast('Community name is required.', 'error')
      return
    }

    setSavingCommunityEdit(true)

    const upsertPayload = {
      id,
      owner_id: userId,
      name,
      color,
    }
    const { error: constellationErr } = await supabase
      .from('constellations')
      .upsert(upsertPayload, { onConflict: 'id' })

    // Backward compatibility with existing schema using "communities".
    if (constellationErr) {
      const { error: fallbackErr } = await supabase
        .from('communities')
        .update({ name, color })
        .eq('owner_id', userId)
        .eq('id', id)
      if (fallbackErr) {
        setSavingCommunityEdit(false)
        showToast(fallbackErr.message || 'Failed to update community.', 'error')
        return
      }
    }

    setCommunities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name, color } : c))
    )
    setEditCommunityOpen(false)
    setEditCommunityId(null)
    setSavingCommunityEdit(false)
    showToast('Community updated ✓', 'success')
  }, [editCommunityId, editCommunityName, editCommunityColor, supabase, userId, showToast])

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
        setAvatarPickerActive(false)
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
        setAvatarPickerActive(false)
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
        setAvatarPickerActive(false)
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
      setAvatarPickerActive(false)
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

  const createDraftPersonAndOpenPanel = useCallback(async () => {
    setSubmitErr(null)
    const locId = locations[0]?.id ?? null
    if (!locId) {
      setSubmitErr('Add a location first, then try again.')
      return
    }
    const group = people.filter((p) => p.location_id === locId)
    const pos = scatterPersonInGroup(group.length, group.length + 1)
    const { data: inserted, error: insErr } = await supabase
      .from('nodes')
      .insert({
        owner_id: userId,
        name: 'New person',
        location_id: locId,
        relationship: 'friend',
        things_to_remember: '',
        custom_attributes: {},
        position_x: pos.x,
        position_y: pos.y,
      })
      .select(
        'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,pos_x,pos_y,avatar_url,is_self,created_at'
      )
      .single()
    if (insErr) {
      setSubmitErr(insErr.message || 'Failed to create person.')
      return
    }
    const nid = inserted?.id as string
    if (nid) setHighlightId(nid)
    await loadData()
    const created = people.find((p) => p.id === nid) ?? null
    // After reload, select from fresh people list (fallback to minimal selection if not found).
    setSelectedPerson(created ?? { ...(inserted as any), is_self: false })
  }, [locations, people, supabase, userId, loadData])

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
    const relation_types = normalizeRelationTags(pendingRelationTags)
    const legacy = legacyTagToRelationTypeLegacyField(relation_types[0] ?? null)
    const label = pendingLabelNote?.trim() || null
    const { error: e } = await supabase.from('edges').insert([
      {
        owner_id: userId,
        source_node_id: pendingConn.source,
        target_node_id: pendingConn.target,
        label,
        community_id: cid,
        relation_type: legacy,
        relation_types,
      },
      {
        owner_id: userId,
        source_node_id: pendingConn.target,
        target_node_id: pendingConn.source,
        label,
        community_id: cid,
        relation_type: legacy,
        relation_types,
      },
    ])
    if (e) setError(e.message)
    clearTransientConnectionPreview()
    setPendingConn(null)
    setPendingCommunityId(null)
    setPendingRelationTags([])
    setPendingLabelNote('')
    await loadData()
  }, [
    pendingConn,
    pendingCommunityId,
    pendingRelationTags,
    pendingLabelNote,
    dbEdges,
    clearTransientConnectionPreview,
    supabase,
    userId,
    loadData,
  ])

  const updateSelectedEdgePair = useCallback(
    async (patch: { community_id?: string | null; label?: string | null; relation_types?: string[]; relation_type?: string | null }) => {
      if (!selectedEdge) return
      const raw = dbEdges.find((d) => d.id === selectedEdge.id)
      if (!raw) return
      const a = raw.source_node_id
      const b = raw.target_node_id
      const rev = dbEdges.find((d) => d.source_node_id === b && d.target_node_id === a)
      const ids = [raw.id, rev?.id].filter(Boolean) as string[]
      if (ids.length === 0) return
      const { error: e } = await supabase
        .from('edges')
        .update(patch)
        .eq('owner_id', userId)
        .in('id', ids)
      if (e) setError(e.message)
      await loadData()
    },
    [selectedEdge, dbEdges, supabase, userId, loadData]
  )

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
    setPendingCommunityId(null)
    setPendingRelationTags([])
    setPendingLabelNote('')
    setPendingConn({ source: c.source, target: c.target })
  }, [])

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== 'person') return
      if (selfNodeId && node.id === selfNodeId) return
      const { x, y } = node.position
      schedulePersistPinnedPosition(node.id, x, y)
    },
    [selfNodeId, schedulePersistPinnedPosition]
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
      <div
        className={`relative min-h-0 w-full flex-1 ${
          constellationMode ? 'bg-zinc-950' : ''
        }`}
      >
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
        connectionMode={ConnectionMode.Loose}
        nodesConnectable={shiftHeld}
        elementsSelectable
        onNodeClick={(_, n) => {
          setNodeContextMenu(null)
          setLocationLineTooltip(null)
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
          setLocationLineTooltip(null)
          setSelectedCommunityId(null)
          setHoverCommunityId(null)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
          setSelectedEdge(null)
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
        }}
        onEdgeClick={(_, e) => {
          setNodeContextMenu(null)
          setLocationLineTooltip(null)
          setSelectedPerson(null)
          setEdges((eds) =>
            eds.map((edge) => ({ ...edge, selected: edge.id === e.id }))
          )
          setSelectedEdge(e)
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
        className={`touch-none h-full w-full bg-zinc-50 dark:bg-[#0a0a0f] ${
          assignCommunityId ? 'cursor-crosshair' : ''
        }`}
      >
        <Background gap={22} size={1.2} />
        {locationOverlayPairs.length > 0 ? (
          <CommunityConnectOverlay
            pairs={locationOverlayPairs}
            stroke="#CBD5E1"
            strokeWidth={0.4}
            strokeOpacity={0.35}
            strokeDasharray="4 6"
            zIndex={2}
            interactive
            onLineClick={({ pairIndex, x, y }) => {
              const p = locationOverlayPairs[pairIndex]
              if (!p) return
              setLocationLineTooltip({ x, y, label: p.label })
            }}
          />
        ) : null}
        {constellationMode && constellationPairs.length > 0 ? (
          <ConstellationOverlay memberIds={constellationMemberIds} pairs={constellationPairs} />
        ) : null}
        {selectedCommunityId && communityOverlayPairs.length > 0 ? (
          <CommunityConnectOverlay
            pairs={communityOverlayPairs}
            stroke={activeConstellationHex}
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
        activeCommunityKey={activeConstellationId}
        onHoverCommunity={(key) => setHoverCommunityId(key)}
        onPickCommunity={(key) => {
          const normalizedKey =
            key === NO_COMMUNITY_KEY
              ? NO_COMMUNITY_KEY
              : normalizeCommunityId(key) ?? NO_COMMUNITY_KEY
          if (selectedCommunityId === normalizedKey) {
            setSelectedCommunityId(null)
            setHoverCommunityId(null)
            setGraphHighlight({ kind: 'none' })
            setSelectedPerson(null)
            setSelectedEdge(null)
            setEdges((eds) =>
              eds.map((edge) => ({ ...edge, selected: false }))
            )
            return
          }
          setSelectedCommunityId(normalizedKey)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
          setSelectedEdge(null)
          setEdges((eds) =>
            eds.map((edge) => ({ ...edge, selected: false }))
          )
        }}
        onEditCommunity={(community) => {
          setEditCommunityId(community.id)
          setEditCommunityName(community.name)
          setEditCommunityColor(community.color)
          setEditCommunityOpen(true)
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
      {locationLineTooltip ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setLocationLineTooltip(null)}
            aria-hidden
          />
          <div
            className="fixed z-40 rounded-md border border-zinc-200 bg-background px-2 py-1 text-xs text-zinc-700 shadow dark:border-zinc-700 dark:text-zinc-300"
            style={{ left: locationLineTooltip.x + 8, top: locationLineTooltip.y + 8 }}
          >
            {locationLineTooltip.label}
          </div>
        </>
      ) : null}
      </div>

      <div className="pointer-events-auto fixed bottom-4 right-4 z-20 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            void createDraftPersonAndOpenPanel()
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
                setConnectRelationTags([])
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
            <label className="mt-3 block text-sm font-medium">Relationship types (optional)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(RELATION_TYPES as unknown as string[]).map((tag) => {
                const selected = connectRelationTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className={relationTagPickerClass(selected)}
                    onClick={() => {
                      const next = selected
                        ? connectRelationTags.filter((t) => t !== tag)
                        : [...connectRelationTags, tag]
                      setConnectRelationTags(normalizeRelationTags(next))
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
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
            <label className="mt-3 block text-sm font-medium">Relationship types (optional)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(RELATION_TYPES as unknown as string[]).map((tag) => {
                const selected = pendingRelationTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className={relationTagPickerClass(selected)}
                    onClick={() => {
                      const next = selected
                        ? pendingRelationTags.filter((t) => t !== tag)
                        : [...pendingRelationTags, tag]
                      setPendingRelationTags(normalizeRelationTags(next))
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
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
            <label className="mt-3 block text-sm font-medium">Note (optional)</label>
            <input
              value={pendingLabelNote}
              onChange={(e) => setPendingLabelNote(e.target.value)}
              placeholder="Optional note"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            />
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
                  setPendingRelationTags([])
                  setPendingLabelNote('')
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
          <label className="mt-3 block text-sm font-medium">Relationship types (optional)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(RELATION_TYPES as unknown as string[]).map((tag) => {
              const selected = selectedEdgeRelationTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  className={relationTagPickerClass(selected)}
                  onClick={() => {
                    const next = selected
                      ? selectedEdgeRelationTags.filter((t) => t !== tag)
                      : [...selectedEdgeRelationTags, tag]
                    const normalized = normalizeRelationTags(next)
                    setSelectedEdgeRelationTags(normalized)
                    const legacy = legacyTagToRelationTypeLegacyField(normalized[0] ?? null)
                    void updateSelectedEdgePair({
                      relation_types: normalized,
                      relation_type: legacy,
                    })
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>
          <label className="mt-3 block text-sm font-medium">Community (optional)</label>
          <select
            value={selectedEdgeCommunityId ?? ''}
            onChange={(e) => {
              const next = normalizeCommunityId(e.target.value || null)
              setSelectedEdgeCommunityId(next)
              void updateSelectedEdgePair({ community_id: next })
            }}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
          >
            <option value="">No community</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="mt-3 block text-sm font-medium">Note (optional)</label>
          <input
            value={selectedEdgeLabel}
            onChange={(e) => {
              const next = e.target.value
              setSelectedEdgeLabel(next)
              void updateSelectedEdgePair({ label: next?.trim() || null })
            }}
            placeholder="Optional note"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
              onClick={() => {
                if (!window.confirm('Delete this connection?')) return
                void deleteEdge()
              }}
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

      <NodeDetailPanel
        open={Boolean(selectedPerson)}
        node={selectedPerson}
        onClose={() => {
          setSelectedCommunityId(null)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
        }}
        avatarPickerActive={avatarPickerActive}
        setAvatarPickerActive={setAvatarPickerActive}
        avatarUploading={avatarUploading}
        uploadNodePhoto={(f) => void uploadNodePhoto(f)}
        panelName={panelName}
        setPanelName={setPanelName}
        personDisplayInitial={personDisplayInitial}
        panelRelationTags={panelRelationTags}
        relationTagPillClass={relationTagPillClass}
        panelPhotos={panelPhotos}
        setPhotoLightbox={setPhotoLightbox}
        addPhotoInputRef={addPhotoInputRef}
        panelSaveState={panelSaveState}
        panelErr={panelErr}
        panelSaving={panelSaving}
        canDelete={Boolean(selectedPerson && !selectedPerson.is_self)}
        onDelete={() => void deletePerson()}
      >
        {selectedPerson ? (
          <>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">Location</label>
              <input
                value={panelLocName}
                onChange={(e) => setPanelLocName(e.target.value)}
                onBlur={() => {
                  const nextName = panelLocName.trim()
                  const prevName =
                    locations.find((l) => l.id === selectedPerson.location_id)?.name ?? ''
                  if (nextName === prevName.trim()) return
                  void (async () => {
                    if (!nextName) {
                      setPanelLocId('')
                      await saveNodePatch(selectedPerson.id, {
                        location_id: null,
                        pos_x: null,
                        pos_y: null,
                      })
                      return
                    }
                    const existing = locations.find(
                      (l) => l.name.trim().toLowerCase() === nextName.toLowerCase()
                    )
                    let locId = existing?.id ?? null
                    if (!locId) {
                      locId = await addLocation(nextName)
                    }
                    if (!locId) return
                    setPanelLocId(locId)
                    await saveNodePatch(selectedPerson.id, {
                      location_id: locId,
                      pos_x: null,
                      pos_y: null,
                    })
                  })()
                }}
                placeholder="e.g. Vancouver"
                className="mt-1 w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
            {!selectedPerson.is_self ? (
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-400">
                  Relationship to You
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(RELATION_TYPES as unknown as string[]).map((tag) => {
                    const selected = panelRelationTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={relationTagPickerClass(selected)}
                        onClick={() => {
                          const next = selected
                            ? panelRelationTags.filter((t) => t !== tag)
                            : [...panelRelationTags, tag]
                          const normalized = normalizeRelationTags(next)
                          setPanelRelationTags(normalized)
                          void saveRelationTagsToUser(normalized)
                        }}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
                {panelRelationTags.join(', ') !== loadedRelationTagsKey ? (
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
              <></>
            ) : null}
          </>
        ) : null}
      </NodeDetailPanel>

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

      {editCommunityOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-background p-6 shadow-xl dark:border-zinc-700"
            role="dialog"
            aria-labelledby="edit-community-title"
          >
            <h3 id="edit-community-title" className="font-semibold">
              Edit community
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Update the community name and colour used across the graph.
            </p>
            <label htmlFor="edit-comm-name" className="mt-4 block text-sm font-medium">
              Name
            </label>
            <input
              id="edit-comm-name"
              value={editCommunityName}
              onChange={(e) => setEditCommunityName(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
              placeholder="e.g. Work, Family"
            />
            <label htmlFor="edit-comm-color" className="mt-3 block text-sm font-medium">
              Colour
            </label>
            <input
              id="edit-comm-color"
              type="color"
              value={editCommunityColor}
              onChange={(e) => setEditCommunityColor(e.target.value)}
              className="mt-1 h-11 w-full cursor-pointer rounded-md border border-zinc-300 bg-background dark:border-zinc-600"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={savingCommunityEdit}
                className="flex-1 rounded-md bg-foreground py-2 text-sm font-medium text-background disabled:opacity-50"
                onClick={() => void saveCommunityEdit()}
              >
                {savingCommunityEdit ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm dark:border-zinc-600"
                onClick={() => setEditCommunityOpen(false)}
              >
                Cancel
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

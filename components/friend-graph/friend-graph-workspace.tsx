'use client'

import { useToast } from '@/components/toast-provider'
import { SmartAttributeField } from '@/components/friend-graph/smart-attribute-field'
import { CommunityConnectOverlay } from '@/components/friend-graph/community-connect-overlay'
import { CommunitiesLegend } from '@/components/friend-graph/communities-legend'
import { ShiftHintSticker } from '@/components/friend-graph/shift-hint-sticker'
import { ConstellationOverlay } from '@/components/friend-graph/constellation-overlay'
import { LabeledEdge } from '@/components/friend-graph/labeled-edge'
import { NodeDetailPanel } from '@/components/friend-graph/node-detail-panel'
import { NodePhotoGallery } from '@/components/friend-graph/node-photo-gallery'
import {
  NodesListView,
  type ListSortMode,
} from '@/components/friend-graph/nodes-list-view'
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
import { normalizeAttributeValueForKey } from '@/lib/date-attribute-helpers'
import {
  customAttributesToRows,
  parseCustomAttributes,
  RELATIONSHIP_VALUES,
  normalizeRelationship,
  relationshipTitle,
  rowsToCustomAttributes,
  scatterPersonInGroup,
  type RelationshipKind,
} from '@/lib/graph-model'
import { uploadNodeGalleryPhoto } from '@/lib/node-photo-ops'
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
import Papa from 'papaparse'
import * as mammoth from 'mammoth'
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
  const missingV9 = /remember_history/i.test(joined)
  if (
    missingTable ||
    missingColumn ||
    missingV4 ||
    missingV5 ||
    missingV6 ||
    missingV7 ||
    missingV8 ||
    missingV9
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

function isRememberHistoryMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = String((error as { code?: unknown }).code ?? '')
  const message = String((error as { message?: unknown }).message ?? '')
  return code === 'PGRST205' || /remember_history/i.test(message)
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
  const base = 'rounded-full px-2 py-0.5 text-xs font-medium border'
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
    'rounded-full px-2 py-0.5 text-xs transition-colors',
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

  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [bulkToolbarMounted, setBulkToolbarMounted] = useState(false)
  const [bulkToolbarEnter, setBulkToolbarEnter] = useState(false)
  const [bulkMenuOpen, setBulkMenuOpen] = useState<
    'community' | 'location' | 'connect' | null
  >(null)
  const [bulkLocName, setBulkLocName] = useState('')
  const [bulkConnectTags, setBulkConnectTags] = useState<string[]>([])
  const [bulkActionBusy, setBulkActionBusy] = useState(false)

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
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [view, setView] = useState<'graph' | 'list'>('graph')
  const [listSearch, setListSearch] = useState('')
  const [listSort, setListSort] = useState<ListSortMode>('az')

  const [addConnectionOpen, setAddConnectionOpen] = useState(false)
  const [connectPersonAId, setConnectPersonAId] = useState('')
  const [connectPersonBId, setConnectPersonBId] = useState('')
  const [connectRelationTags, setConnectRelationTags] = useState<string[]>([])
  const [connectCommunityId, setConnectCommunityId] = useState<string | null>(null)
  const [connectNote, setConnectNote] = useState('')
  const [connectErr, setConnectErr] = useState<string | null>(null)

  const [showHelp, setShowHelp] = useState(false)
  const [helpModalEntered, setHelpModalEntered] = useState(false)
  const [aiGlowNodeIds, setAiGlowNodeIds] = useState<string[]>([])
  const aiGlowClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [importAiOpen, setImportAiOpen] = useState(false)
  const [importAiText, setImportAiText] = useState('')
  const [importAiFileName, setImportAiFileName] = useState<string | null>(null)
  const [importAiSourceText, setImportAiSourceText] = useState<string>('')
  const [importAiBusy, setImportAiBusy] = useState(false)
  const [importAiStage, setImportAiStage] = useState<'input' | 'preview'>('input')
  const [importAiPeople, setImportAiPeople] = useState<
    {
      id: string
      name: string
      relationship: string | null
      location: string | null
      things_to_remember: string | null
      custom_attributes_text: string
    }[]
  >([])
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
  const [photoGalleryRefresh, setPhotoGalleryRefresh] = useState(0)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr, setPanelErr] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [panelName, setPanelName] = useState('')
  const [creatingDraftNode, setCreatingDraftNode] = useState(false)
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
  const [relationshipHistoryOpen, setRelationshipHistoryOpen] =
    useState(false)
  const [photosSectionOpen, setPhotosSectionOpen] = useState(false)
  const [galleryPhotoCount, setGalleryPhotoCount] = useState(0)
  const [customAttrsShowAll, setCustomAttrsShowAll] = useState(false)
  const [connectionsShowAll, setConnectionsShowAll] = useState(false)
  const [panelNotesFocused, setPanelNotesFocused] = useState(false)

  const [showLeftPanel, setShowLeftPanel] = useState(true)

  const pinSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRowsRef = useRef(panelRows)
  panelRowsRef.current = panelRows
  const shiftRef = useRef(shiftHeld)
  shiftRef.current = shiftHeld

  useEffect(() => {
    try {
      const v = localStorage.getItem('starmap_left_panel_visible')
      if (v === 'false') setShowLeftPanel(false)
      else if (v === 'true') setShowLeftPanel(true)
    } catch {
      // ignore
    }
  }, [])

  const selfNodeId = useMemo(
    () => people.find((p) => p.is_self)?.id ?? null,
    [people]
  )

  const tagsByPersonId = useMemo(() => {
    const m = new Map<string, string[]>()
    if (!selfNodeId) return m
    const edges = dedupeEdgesForGraph(dbEdges)
    for (const p of people) {
      if (p.is_self) continue
      const edge = edges.find(
        (e) =>
          pairKey(e.source_node_id, e.target_node_id) ===
          pairKey(selfNodeId, p.id)
      )
      const tagsRaw = (edge as { relation_types?: unknown } | undefined)
        ?.relation_types
      let tags: string[] = []
      if (Array.isArray(tagsRaw)) {
        tags = normalizeRelationTags(tagsRaw as string[])
      } else {
        tags = normalizeRelationTags(
          legacyRelationTypeToTags(edge?.relation_type ?? null)
        )
      }
      m.set(p.id, tags)
    }
    return m
  }, [people, selfNodeId, dbEdges])

  const totalNonSelfPeople = useMemo(
    () => people.filter((p) => !p.is_self).length,
    [people]
  )

  const panelAttributesMap = useMemo(() => {
    const o: Record<string, string> = {}
    for (const r of panelRows) {
      const k = r.key.trim()
      if (k) o[k] = r.value
    }
    return o
  }, [panelRows])

  const listRows = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    let rows = people.filter((p) => !p.is_self)
    if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q))
    const sorted = [...rows]
    if (listSort === 'az') {
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      )
    } else if (listSort === 'za') {
      sorted.sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
      )
    } else {
      sorted.sort((a, b) => {
        const ta = a.created_at ?? ''
        const tb = b.created_at ?? ''
        return tb.localeCompare(ta)
      })
    }
    return sorted
  }, [people, listSearch, listSort])

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

  const panelDedupedConnections = useMemo(
    () =>
      selectedPerson
        ? edgesForPersonDeduped(dbEdges, selectedPerson.id)
        : [],
    [selectedPerson, dbEdges]
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
        aiImportGlowIds: aiGlowNodeIds,
      }),
    [
      locations,
      people,
      dbEdges,
      needsForceLayout,
      highlightId,
      communityColorMap,
      selfNodeId,
      aiGlowNodeIds,
    ]
  )

  const activeConstellationId = useMemo(() => {
    if (selectedLocationId) return null
    const key = hoverCommunityId ?? selectedCommunityId
    return key
  }, [hoverCommunityId, selectedCommunityId, selectedLocationId])

  const activeConstellationHex = useMemo(() => {
    if (!activeConstellationId) return DEFAULT_EDGE_NEUTRAL
    if (activeConstellationId === NO_COMMUNITY_KEY) return DEFAULT_EDGE_NEUTRAL
    const cid = normalizeCommunityId(activeConstellationId)
    return (cid ? communityColorMap.get(cid) : null) ?? DEFAULT_EDGE_NEUTRAL
  }, [activeConstellationId, communityColorMap])

  const locationRowsForLegend = useMemo(() => {
    return locations
      .map((l) => ({
        id: l.id,
        name: l.name,
        count: people.filter((p) => p.location_id === l.id).length,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, people])

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

  const memberSetForLocation = useMemo(() => {
    if (!selectedLocationId) return null
    const out = new Set<string>()
    for (const p of people) {
      if (p.location_id === selectedLocationId) out.add(p.id)
    }
    return out
  }, [selectedLocationId, people])

  const constellationMode = Boolean(
    activeConstellationId && activeConstellationId !== NO_COMMUNITY_KEY
  )
  const locationMode = Boolean(selectedLocationId)

  const constellationMemberIds = useMemo(
    () => (memberSetForConstellation ? [...memberSetForConstellation] : []),
    [memberSetForConstellation]
  )
  const locationMemberIds = useMemo(
    () => (memberSetForLocation ? [...memberSetForLocation] : []),
    [memberSetForLocation]
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
    const activeSet = locationMode ? memberSetForLocation : memberSetForConstellation
    if (!activeSet) return initialNodes
    const glowHex = locationMode ? '#fbbf24' : activeConstellationHex
    return initialNodes.map((n) => {
      if (n.type !== 'person') return n
      const inSet = activeSet.has(n.id)
      const baseData = (n.data ?? {}) as Record<string, unknown>
      const memberCommunityIds = nodeCommunityMap.get(n.id) ?? []
      const memberDots = memberCommunityIds
        .map((cid) => communityColorMap.get(cid))
        .filter((hex): hex is string => typeof hex === 'string' && hex.length > 0)
      return {
        ...n,
        style: {
          ...n.style,
          opacity: inSet ? 1 : locationMode || constellationMode ? 0.1 : 0.15,
          transition: 'opacity 0.28s ease',
        },
        data: {
          ...baseData,
          communityMemberGlowHex: inSet ? glowHex : null,
          constellationMode: inSet ? (constellationMode || locationMode) : false,
          communityColorDots: memberDots,
        },
      }
    })
  }, [
    initialNodes,
    locationMode,
    memberSetForLocation,
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

  const selectPersonFromList = useCallback(
    (person: DbPerson) => {
      setNodeContextMenu(null)
      setLocationLineTooltip(null)
      setSelectedCommunityId(null)
      setHoverCommunityId(null)
      setSelectedLocationId(null)
      setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
      setSelectedEdge(null)
      setSelectedNodeIds(new Set())
      setGraphHighlight({ kind: 'node', nodeId: person.id })
      setSelectedPerson(person)
    },
    [setEdges]
  )

  useEffect(() => {
    if (view === 'list') {
      setNodeContextMenu(null)
      setLocationLineTooltip(null)
      setSelectedNodeIds(new Set())
    }
  }, [view])

  const showBulkToolbar = selectedNodeIds.size >= 2
  useEffect(() => {
    if (showBulkToolbar) {
      setBulkToolbarMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setBulkToolbarEnter(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setBulkToolbarEnter(false)
    const t = window.setTimeout(() => setBulkToolbarMounted(false), 200)
    return () => window.clearTimeout(t)
  }, [showBulkToolbar])

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
                  multiSelected: selectedNodeIds.has(n.id),
                  selectedInPanel: selectedPerson?.id === n.id,
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
  }, [
    nodesForFlow,
    styledEdges,
    setNodes,
    setEdges,
    selectedNodeIds,
    selectedPerson?.id,
  ])

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
    if (!showHelp) {
      setHelpModalEntered(false)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHelpModalEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [showHelp])

  useEffect(() => {
    return () => {
      if (aiGlowClearRef.current != null) {
        clearTimeout(aiGlowClearRef.current)
        aiGlowClearRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowHelp(false)
        setAssignCommunityId(null)
        setNodeContextMenu(null)
        setBulkMenuOpen(null)
        setSelectedNodeIds(new Set())
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

  const showSaveStatus = useCallback(
    (s: 'idle' | 'saving' | 'saved' | 'error') => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current)
        saveStatusTimerRef.current = null
      }
      setSaveStatus(s)
      if (s === 'saved') {
        setPanelErr(null)
        saveStatusTimerRef.current = setTimeout(() => {
          setSaveStatus('idle')
          saveStatusTimerRef.current = null
        }, 1500)
      }
    },
    []
  )

  const markSaveSuccess = useCallback(() => {
    showSaveStatus('saved')
  }, [showSaveStatus])

  const markSaveFail = useCallback(
    (msg?: string) => {
      setPanelErr(msg || 'Failed to save')
      showSaveStatus('error')
    },
    [showSaveStatus]
  )

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
      showSaveStatus('saving')
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
          showSaveStatus('error')
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
          showSaveStatus('error')
          return
        }
      }
      await refreshNodeCommunities()
      showSaveStatus('saved')
    },
    [nodeCommunityMap, supabase, userId, refreshNodeCommunities, showSaveStatus]
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
    setSaveStatus('idle')
  }, [selectedPerson?.id])

  useEffect(() => {
    if (!selectedPerson) setAvatarPickerActive(false)
  }, [selectedPerson])

  useEffect(() => {
    setRememberHistoryOpen(false)
    setRelationshipHistoryOpen(false)
    setPhotosSectionOpen(false)
    setCustomAttrsShowAll(false)
    setConnectionsShowAll(false)
    setPanelNotesFocused(false)
    setGalleryPhotoCount(0)
  }, [selectedPerson?.id])

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
        if (isRememberHistoryMissingError(error)) {
          setRememberHistory([])
          return
        }
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

  const refreshSelectedAfterAutosave = useCallback(
    async (personId: string) => {
      const nextPeople = await loadData()
      if (!nextPeople) return
      const p = nextPeople.find((x) => x.id === personId) ?? null
      setSelectedPerson(p)
    },
    [loadData]
  )

  const saveNodeField = useCallback(
    async (field: string, value: unknown) => {
      if (!selectedPerson?.id || selectedPerson.id.startsWith('__draft__')) return
      showSaveStatus('saving')
      const { error } = await supabase
        .from('nodes')
        .update({ [field]: value })
        .eq('id', selectedPerson.id)
        .eq('owner_id', userId)
      if (error) {
        setPanelErr(error.message)
        showSaveStatus('error')
        return
      }
      await refreshSelectedAfterAutosave(selectedPerson.id)
      showSaveStatus('saved')
    },
    [selectedPerson, supabase, userId, refreshSelectedAfterAutosave, showSaveStatus]
  )

  const handlePanelNameBlur = useCallback(async () => {
    if (!selectedPerson || selectedPerson.id.startsWith('__draft__')) return
    const next = panelName.trim() || 'Unnamed'
    if (next === selectedPerson.name) return
    await saveNodeField('name', next)
  }, [selectedPerson, panelName, saveNodeField])

  const saveThingsToRememberWithHistory = useCallback(async () => {
    if (!selectedPerson) return
    const nextContent = panelNotes
    if (nextContent === selectedPerson.things_to_remember) return
    showSaveStatus('saving')
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
    if (herr && !isRememberHistoryMissingError(herr)) {
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
    showSaveStatus,
  ])

  useEffect(() => {
    if (!selectedPerson) return
    const rows = customAttributesToRows(parseCustomAttributes(selectedPerson.custom_attributes))
    const normalizedRows = rows.map((r) => {
      const next = normalizeAttributeValueForKey(r.key, r.value)
      if (next === r.value) return r
      return { ...r, value: next }
    })
    setPanelRows(normalizedRows)
  }, [selectedPerson])

  const persistCustomAttributesBlur = useCallback(async () => {
    if (!selectedPerson || selectedPerson.id.startsWith('__draft__')) return
    showSaveStatus('saving')
    const rows = panelRowsRef.current
    const attrs = rowsToCustomAttributes(rows)
    const { error } = await supabase
      .from('nodes')
      .update({ custom_attributes: attrs })
      .eq('id', selectedPerson.id)
      .eq('owner_id', userId)
    if (error) {
      console.error('[custom_attributes] blur save', error)
      setPanelErr(error.message)
      showSaveStatus('error')
      return
    }
    setPanelErr(null)
    setPeople((prev) =>
      prev.map((p) =>
        p.id === selectedPerson.id ? { ...p, custom_attributes: attrs } : p
      )
    )
    setSelectedPerson((p) =>
      p && p.id === selectedPerson.id ? { ...p, custom_attributes: attrs } : p
    )
    showSaveStatus('saved')
  }, [selectedPerson, supabase, userId, showSaveStatus])

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

      showSaveStatus('saving')

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
      showSaveStatus,
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

  const resetImportAi = useCallback(() => {
    setImportAiText('')
    setImportAiFileName(null)
    setImportAiSourceText('')
    setImportAiBusy(false)
    setImportAiStage('input')
    setImportAiPeople([])
  }, [])

  const extractTextFromImportFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const csvText = await file.text()
      const parsed = Papa.parse<string[]>(csvText, {
        skipEmptyLines: true,
      })
      if (parsed.errors?.length) {
        throw new Error(parsed.errors[0]?.message || 'Failed to parse CSV')
      }
      const rows = (parsed.data ?? []) as unknown as string[][]
      const text = rows
        .map((r) =>
          (r ?? [])
            .map((cell) => String(cell ?? '').trim())
            .filter(Boolean)
            .join(' | ')
        )
        .filter(Boolean)
        .join('\n')
      return text
    }
    if (ext === 'txt') {
      return await file.text()
    }
    if (ext === 'docx') {
      const ab = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: ab })
      return String((result as any)?.value ?? '').trim()
    }
    throw new Error('Unsupported file type')
  }, [])

  const runGeminiImport = useCallback(async () => {
    const sourceText = (importAiText || importAiSourceText).trim()
    if (!sourceText) {
      showToast('Paste text or upload a file first.', 'error')
      return
    }

    setImportAiBusy(true)
    try {
      const res = await fetch('/api/ai/extract-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText }),
      })

      const payload = (await res.json()) as { people?: unknown[]; error?: string }

      if (!res.ok) {
        showToast(payload?.error || 'Could not parse response — try rephrasing your input.', 'error')
        return
      }

      const arr = payload?.people
      if (!Array.isArray(arr)) {
        showToast('Could not parse response — try rephrasing your input.', 'error')
        return
      }

      const next = arr
        .map((p: any, idx: number) => {
          const name = typeof p?.name === 'string' ? p.name.trim() : ''
          const relationship =
            p?.relationship == null ? null : String(p.relationship).trim().toLowerCase()
          const location = typeof p?.location === 'string' ? p.location.trim() : null
          const things =
            typeof p?.things_to_remember === 'string'
              ? p.things_to_remember.trim()
              : null
          const attrs = p?.custom_attributes
          const attrsText =
            attrs && typeof attrs === 'object' && !Array.isArray(attrs)
              ? JSON.stringify(attrs, null, 2)
              : ''
          return {
            id: `ai-${Date.now()}-${idx}`,
            name,
            relationship: relationship || null,
            location: location && location.length ? location : null,
            things_to_remember: things && things.length ? things : null,
            custom_attributes_text: attrsText,
          }
        })
        .filter((p: any) => p.name)

      setImportAiPeople(next)
      setImportAiStage('preview')
    } catch (e) {
      console.error('[import-ai]', e)
      showToast('Could not parse response — try rephrasing your input.', 'error')
    } finally {
      setImportAiBusy(false)
    }
  }, [importAiText, importAiSourceText, showToast])

  const addImportedPeopleToGraph = useCallback(async () => {
    if (importAiPeople.length === 0) return

    setImportAiBusy(true)
    try {
      const existingLocByName = new Map(
        locations.map((l) => [l.name.trim().toLowerCase(), l.id])
      )
      const locationIdByName = new Map(existingLocByName)

      const ensureLocationId = async (name: string): Promise<string | null> => {
        const t = name.trim()
        if (!t) return null
        const key = t.toLowerCase()
        const existing = locationIdByName.get(key)
        if (existing) return existing
        const { data, error } = await supabase
          .from('locations')
          .insert({ user_id: userId, name: t })
          .select('id')
          .single()
        if (error) throw error
        const id = String((data as any)?.id ?? '')
        if (id) locationIdByName.set(key, id)
        return id || null
      }

      const groupCounts = new Map<string | null, number>()
      for (const p of people) {
        const key = (p.location_id ?? null) as string | null
        groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1)
      }

      const rows: any[] = []
      for (const p of importAiPeople) {
        const name = p.name.trim()
        if (!name) continue
        const locId = p.location ? await ensureLocationId(p.location) : null

        const prevCount = groupCounts.get(locId) ?? 0
        const pos = scatterPersonInGroup(prevCount, prevCount + 1)
        groupCounts.set(locId, prevCount + 1)

        let attrs: Record<string, unknown> = {}
        const attrsRaw = p.custom_attributes_text?.trim()
        if (attrsRaw) {
          try {
            const parsed = JSON.parse(attrsRaw)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) attrs = parsed
          } catch {
            // ignore; keep attrs empty
          }
        }

        const relRaw = p.relationship ? String(p.relationship) : ''
        const rel =
          relRaw === 'partner' ? 'romantic' : relRaw === 'enemy' ? 'network' : relRaw

        rows.push({
          owner_id: userId,
          name,
          relationship: normalizeRelationship(rel),
          location_id: locId,
          things_to_remember: p.things_to_remember?.trim() || '',
          custom_attributes: attrs,
          position_x: pos.x,
          position_y: pos.y,
        })
      }

      if (rows.length === 0) {
        showToast('No valid people to add.', 'error')
        return
      }

      const { data: inserted, error } = await supabase
        .from('nodes')
        .insert(rows)
        .select('id')
      if (error) {
        showToast(error.message || 'Failed to import people.', 'error')
        return
      }

      const newIds = (inserted ?? [])
        .map((r: { id: string }) => String(r.id))
        .filter(Boolean)
      if (aiGlowClearRef.current != null) {
        clearTimeout(aiGlowClearRef.current)
        aiGlowClearRef.current = null
      }
      setAiGlowNodeIds(newIds)
      aiGlowClearRef.current = setTimeout(() => {
        setAiGlowNodeIds([])
        aiGlowClearRef.current = null
      }, 10_000)

      await loadData()
      showToast(`${rows.length} people added ✓`, 'success')
      setImportAiOpen(false)
      resetImportAi()
    } catch (e) {
      console.error('[import-ai-add]', e)
      showToast('Failed to import people.', 'error')
    } finally {
      setImportAiBusy(false)
    }
  }, [
    importAiPeople,
    locations,
    people,
    supabase,
    userId,
    loadData,
    showToast,
    resetImportAi,
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
    showToast('Constellation created.', 'success')
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
      showToast('Constellation name is required.', 'error')
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
    showToast('Constellation updated ✓', 'success')
  }, [editCommunityId, editCommunityName, editCommunityColor, supabase, userId, showToast])

  const onGalleryPrimaryAvatarChange = useCallback(
    (url: string | null) => {
      const id = selectedPerson?.id
      if (!id || id.startsWith('__draft__')) return
      patchPersonAvatar(id, url)
    },
    [selectedPerson?.id, patchPersonAvatar]
  )

  const uploadNodePhoto = useCallback(
    async (file: File) => {
      if (!selectedPerson) return
      const personId = selectedPerson.id
      if (personId.startsWith('__draft__')) {
        setPanelErr('Save this person before adding photos.')
        setAvatarPickerActive(false)
        return
      }
      setAvatarUploading(true)
      setPanelErr(null)
      const result = await uploadNodeGalleryPhoto(supabase, personId, file)
      setAvatarUploading(false)
      setAvatarPickerActive(false)
      if (!result.ok) {
        setPanelErr(result.message)
        return
      }
      if (result.wasPrimary) {
        patchPersonAvatar(personId, result.publicUrl)
      }
      setPhotoGalleryRefresh((k) => k + 1)
    },
    [selectedPerson, supabase, patchPersonAvatar]
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

  const handlePanelLocationBlur = useCallback(async () => {
    if (!selectedPerson || selectedPerson.id.startsWith('__draft__')) return
    const nextLocName = panelLocName.trim()
    let locId: string | null = selectedPerson.location_id
    if (nextLocName) {
      const existing = locations.find(
        (l) => l.name.trim().toLowerCase() === nextLocName.toLowerCase()
      )
      locId = existing?.id ?? null
      if (!locId) locId = await addLocation(nextLocName)
    } else {
      locId = null
    }
    if (locId === selectedPerson.location_id) return
    await saveNodeField('location_id', locId)
  }, [selectedPerson, panelLocName, locations, addLocation, saveNodeField])

  const bulkAddNodesToCommunity = useCallback(
    async (communityId: string) => {
      const cid = normalizeCommunityId(communityId)
      if (!cid) return
      const ids = [...selectedNodeIds].filter((id) => {
        const p = people.find((x) => x.id === id)
        return p && !p.is_self
      })
      if (ids.length === 0) return
      const rows: {
        owner_id: string
        node_id: string
        community_id: string
        joined_at: string
      }[] = []
      for (const nodeId of ids) {
        if (nodeCommunityMap.get(nodeId)?.includes(cid)) continue
        rows.push({
          owner_id: userId,
          node_id: nodeId,
          community_id: cid,
          joined_at: new Date().toISOString(),
        })
      }
      if (rows.length === 0) {
        showToast('Everyone already in that community.', 'success')
        setSelectedNodeIds(new Set())
        setBulkMenuOpen(null)
        return
      }
      setBulkActionBusy(true)
      const { error } = await supabase.from('node_communities').insert(rows)
      setBulkActionBusy(false)
      if (error) {
        showToast(error.message, 'error')
        return
      }
      await refreshNodeCommunities()
      const comm = communities.find((c) => c.id === cid)
      showToast(`Added to ${comm?.name ?? 'constellation'} ✓`, 'success')
      setSelectedNodeIds(new Set())
      setBulkMenuOpen(null)
    },
    [
      selectedNodeIds,
      people,
      nodeCommunityMap,
      supabase,
      userId,
      refreshNodeCommunities,
      communities,
      showToast,
    ]
  )

  const bulkApplyLocation = useCallback(async () => {
    const trimmed = bulkLocName.trim()
    if (!trimmed) {
      showToast('Enter a location name.', 'error')
      return
    }
    let locId: string | null =
      locations.find((l) => l.name.trim().toLowerCase() === trimmed.toLowerCase())
        ?.id ?? null
    if (!locId) {
      locId = await addLocation(trimmed)
    }
    if (!locId) return
    const ids = [...selectedNodeIds].filter(
      (id) => !people.find((p) => p.id === id)?.is_self
    )
    if (ids.length === 0) return
    setBulkActionBusy(true)
    const { error } = await supabase
      .from('nodes')
      .update({ location_id: locId })
      .eq('owner_id', userId)
      .in('id', ids)
    setBulkActionBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    await loadData()
    showToast('Locations updated ✓', 'success')
    setSelectedNodeIds(new Set())
    setBulkMenuOpen(null)
    setBulkLocName('')
  }, [
    bulkLocName,
    selectedNodeIds,
    people,
    locations,
    addLocation,
    supabase,
    userId,
    loadData,
    showToast,
  ])

  const bulkApplyConnect = useCallback(async () => {
    const relation_types = normalizeRelationTags(bulkConnectTags)
    if (relation_types.length === 0) {
      showToast('Pick at least one relation tag.', 'error')
      return
    }
    const legacy = legacyTagToRelationTypeLegacyField(relation_types[0] ?? null)
    const ids = [...selectedNodeIds].filter(
      (id) => !people.find((p) => p.id === id)?.is_self
    )
    if (ids.length < 2) {
      showToast('Need at least two people to connect.', 'error')
      return
    }
    const deduped = dedupeEdgesForGraph(dbEdges)
    let pairsCreated = 0
    const rows: {
      owner_id: string
      source_node_id: string
      target_node_id: string
      relation_types: string[]
      relation_type: string | null
      community_id: null
      label: null
    }[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!
        const b = ids[j]!
        const exists = deduped.some(
          (e) =>
            pairKey(e.source_node_id, e.target_node_id) === pairKey(a, b)
        )
        if (exists) continue
        pairsCreated += 1
        rows.push(
          {
            owner_id: userId,
            source_node_id: a,
            target_node_id: b,
            relation_types,
            relation_type: legacy,
            community_id: null,
            label: null,
          },
          {
            owner_id: userId,
            source_node_id: b,
            target_node_id: a,
            relation_types,
            relation_type: legacy,
            community_id: null,
            label: null,
          }
        )
      }
    }
    if (rows.length === 0) {
      showToast('Those connections already exist.', 'success')
      setSelectedNodeIds(new Set())
      setBulkMenuOpen(null)
      return
    }
    setBulkActionBusy(true)
    const { error } = await supabase.from('edges').insert(rows)
    setBulkActionBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    await loadData()
    showToast(`${pairsCreated} connections created ✓`, 'success')
    setSelectedNodeIds(new Set())
    setBulkMenuOpen(null)
    setBulkConnectTags([])
  }, [
    bulkConnectTags,
    selectedNodeIds,
    people,
    dbEdges,
    supabase,
    userId,
    loadData,
    showToast,
  ])

  const createDraftPersonAndOpenPanel = useCallback(async () => {
    setSubmitErr(null)
    const locId = locations[0]?.id ?? null
    if (!locId) {
      setSubmitErr('Add a location first, then try again.')
      return
    }
    setCreatingDraftNode(true)
    const draftId = `__draft__-${Date.now()}`
    setSelectedPerson({
      id: draftId,
      name: 'New person',
      location_id: locId,
      relationship: 'friend',
      things_to_remember: '',
      custom_attributes: {},
      position_x: null,
      position_y: null,
      pos_x: null,
      pos_y: null,
      avatar_url: null,
      is_self: false,
      created_at: null,
    })
  }, [locations])

  const savePanelExplicit = useCallback(async () => {
    if (!selectedPerson) return
    setPanelSaving(true)
    showSaveStatus('saving')
    setPanelErr(null)
    try {
      const nextName = panelName.trim() || 'Unnamed'
      const nextLocName = panelLocName.trim()
      let locId = selectedPerson.location_id
      if (nextLocName) {
        const existing = locations.find(
          (l) => l.name.trim().toLowerCase() === nextLocName.toLowerCase()
        )
        locId = existing?.id ?? null
        if (!locId) locId = await addLocation(nextLocName)
      } else {
        locId = null
      }
      const nodePatch = {
        name: nextName,
        location_id: locId,
        things_to_remember: panelNotes,
        custom_attributes: rowsToCustomAttributes(panelRows),
      }
      if (creatingDraftNode || selectedPerson.id.startsWith('__draft__')) {
        const group = people.filter((p) => p.location_id === locId)
        const pos = scatterPersonInGroup(group.length, group.length + 1)
        const { data: inserted, error: insErr } = await supabase
          .from('nodes')
          .insert({
            owner_id: userId,
            ...nodePatch,
            relationship: 'friend',
            position_x: pos.x,
            position_y: pos.y,
          })
          .select(
            'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,pos_x,pos_y,avatar_url,is_self,created_at'
          )
          .single()
        if (insErr) {
          showToast(insErr.message || 'Failed to save node.', 'error')
          throw insErr
        }
        const newNode = {
          ...(inserted as any),
          position: { x: Number((inserted as any).position_x ?? 0), y: Number((inserted as any).position_y ?? 0) },
          data: {},
        }
        setNodes((prev) => [...prev])
        setCreatingDraftNode(false)
        setHighlightId(String((inserted as any).id))
        await loadData()
        showToast('Node saved ✓', 'success')
      } else {
        const { error: uerr } = await supabase
          .from('nodes')
          .update(nodePatch)
          .eq('id', selectedPerson.id)
          .eq('owner_id', userId)
        if (uerr) {
          showToast(uerr.message || 'Failed to save node.', 'error')
          throw uerr
        }
        if (panelNotes !== selectedPerson.things_to_remember) {
          const { error: rememberErr } = await supabase.from('remember_history').insert({
            owner_id: userId,
            node_id: selectedPerson.id,
            content: panelNotes,
            saved_at: new Date().toISOString(),
          })
          if (rememberErr && !isRememberHistoryMissingError(rememberErr)) {
            throw rememberErr
          }
        }
        if (!selectedPerson.is_self) {
          await saveRelationTagsToUser(panelRelationTags)
        }
        await loadData()
        showToast('Node saved ✓', 'success')
      }
      markSaveSuccess()
    } catch (e) {
      markSaveFail((e as Error)?.message || 'Failed to save')
    } finally {
      setPanelSaving(false)
    }
  }, [
    selectedPerson,
    panelName,
    panelLocName,
    panelNotes,
    panelRows,
    creatingDraftNode,
    locations,
    addLocation,
    people,
    supabase,
    userId,
    setNodes,
    loadData,
    panelRelationTags,
    saveRelationTagsToUser,
    markSaveSuccess,
    markSaveFail,
    showToast,
    showSaveStatus,
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
      <div className="flex shrink-0 items-center justify-end gap-3 border-b border-zinc-200 bg-background px-3 py-2 dark:border-zinc-800">
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView('graph')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'graph'
                ? 'bg-white text-black dark:bg-white dark:text-black'
                : 'border border-gray-700 bg-transparent text-gray-400 hover:bg-white/5 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            ⬡ Graph
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'list'
                ? 'bg-white text-black dark:bg-white dark:text-black'
                : 'border border-gray-700 bg-transparent text-gray-400 hover:bg-white/5 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            ≡ List
          </button>
        </div>
      </div>
      <div
        className={`relative min-h-0 w-full flex-1 flex flex-col ${
          view === 'graph' && constellationMode ? 'bg-zinc-950' : ''
        }`}
      >
      {view === 'graph' ? (
        <>
      {assignCommunityId ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-zinc-300/80 bg-background/95 px-3 py-1 text-xs text-zinc-700 shadow dark:border-zinc-700 dark:text-zinc-300">
          Click nodes to add/remove from{' '}
          <span className="font-semibold">
            {communities.find((c) => c.id === assignCommunityId)?.name ?? 'constellation'}
          </span>
          . Click ✏️ again or press Esc to exit.
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-row">
        <div
          className={`shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            showLeftPanel ? 'w-56 opacity-100' : 'pointer-events-none w-0 opacity-0'
          }`}
        >
          <div className="box-border h-full w-56 min-h-0 overflow-y-auto p-2 pr-1">
            <CommunitiesLegend
              communities={communities.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
              }))}
              activeCommunityKey={activeConstellationId}
              activeLocationId={selectedLocationId}
              locations={locationRowsForLegend}
              onHoverCommunity={(key) => setHoverCommunityId(key)}
              onPickCommunity={(key) => {
                setSelectedLocationId(null)
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
              onPickLocation={(locationId) => {
                setHoverCommunityId(null)
                setSelectedCommunityId(null)
                setSelectedPerson(null)
                setSelectedEdge(null)
                setGraphHighlight({ kind: 'none' })
                setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
                setSelectedLocationId((prev) => (prev === locationId ? null : locationId))
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
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <button
            type="button"
            aria-label={
              showLeftPanel
                ? 'Hide communities and locations panel'
                : 'Show communities and locations panel'
            }
            aria-expanded={showLeftPanel}
            onClick={() => {
              setShowLeftPanel((prev) => {
                const next = !prev
                try {
                  localStorage.setItem('starmap_left_panel_visible', String(next))
                } catch {
                  // ignore
                }
                return next
              })
            }}
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-r-lg border border-gray-200 bg-white px-1 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            {showLeftPanel ? '‹' : '›'}
          </button>
          <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag={false}
        connectionLineStyle={{ stroke: 'transparent' }}
        defaultEdgeOptions={{ style: { strokeDasharray: 'none' } }}
        nodesConnectable={shiftHeld}
        elementsSelectable
        onNodeClick={(event, n) => {
          setNodeContextMenu(null)
          setLocationLineTooltip(null)
          if (event.shiftKey && n.type === 'person') {
            const row = people.find((p) => p.id === n.id)
            if (row?.is_self) return
            event.preventDefault()
            setSelectedNodeIds((prev) => {
              const next = new Set(prev)
              if (next.has(n.id)) next.delete(n.id)
              else next.add(n.id)
              return next
            })
            return
          }
          if (assignCommunityId && n.type === 'person') {
            void toggleNodeCommunityMembership(n.id, assignCommunityId)
            return
          }
          setSelectedNodeIds(new Set())
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
          setSelectedNodeIds(new Set())
          setSelectedCommunityId(null)
          setHoverCommunityId(null)
          setSelectedLocationId(null)
          setGraphHighlight({ kind: 'none' })
          setSelectedPerson(null)
          setSelectedEdge(null)
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
        }}
        onEdgeClick={(_, e) => {
          setNodeContextMenu(null)
          setLocationLineTooltip(null)
          setSelectedNodeIds(new Set())
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
        {locationMode && locationMemberIds.length > 0 ? (
          <ConstellationOverlay memberIds={locationMemberIds} pairs={[]} />
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
          <ShiftHintSticker
            visible={selectedNodeIds.size === 0}
          />
        {bulkToolbarMounted && view === 'graph' ? (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <div
              className={`relative flex items-center gap-2 rounded-2xl border border-white/10 bg-gray-900 px-4 py-2.5 text-white shadow-2xl transition-all duration-200 ease-out dark:border-gray-200 dark:bg-white dark:text-gray-900 ${
                bulkToolbarEnter
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-5 opacity-0'
              }`}
            >
              {bulkMenuOpen === 'community' ? (
                <div className="absolute bottom-full left-1/2 z-[60] mb-2 max-h-56 min-w-[14rem] -translate-x-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-600 dark:bg-zinc-900">
                  {communities.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-zinc-500">No constellations yet</p>
                  ) : (
                    communities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={bulkActionBusy}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        onClick={() => void bulkAddNodesToCommunity(c.id)}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="flex-1">{c.name}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              {bulkMenuOpen === 'location' ? (
                <div className="absolute bottom-full left-1/2 z-[60] mb-2 w-[min(90vw,18rem)] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-600 dark:bg-zinc-900">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Set location for {selectedNodeIds.size} people:
                  </p>
                  <input
                    type="text"
                    value={bulkLocName}
                    onChange={(e) => setBulkLocName(e.target.value)}
                    placeholder="Location name"
                    className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={bulkActionBusy}
                    onClick={() => void bulkApplyLocation()}
                    className="mt-2 w-full rounded-lg bg-zinc-900 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Apply
                  </button>
                </div>
              ) : null}
              {bulkMenuOpen === 'connect' ? (
                <div className="absolute bottom-full left-1/2 z-[60] mb-2 w-[min(92vw,22rem)] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-600 dark:bg-zinc-900">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Pick one or more relation tags
                  </p>
                  <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {(RELATION_TYPES as unknown as string[]).map((tag) => {
                      const sel = bulkConnectTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setBulkConnectTags((prev) =>
                              sel
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag]
                            )
                          }}
                          className={relationTagPickerClass(sel)}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={bulkActionBusy || bulkConnectTags.length === 0}
                    onClick={() => void bulkApplyConnect()}
                    className="mt-3 w-full rounded-lg bg-zinc-900 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Apply
                  </button>
                </div>
              ) : null}

              <span className="text-sm font-medium opacity-70">
                {selectedNodeIds.size} selected
              </span>
              <div className="h-4 w-px bg-white/20 dark:bg-gray-300" aria-hidden />
              <button
                type="button"
                disabled={bulkActionBusy}
                onClick={() =>
                  setBulkMenuOpen((m) => (m === 'community' ? null : 'community'))
                }
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50 dark:hover:bg-black/10"
              >
                <span className="text-violet-400" aria-hidden>
                  ●
                </span>
                Add to constellation
              </button>
              <button
                type="button"
                disabled={bulkActionBusy}
                onClick={() =>
                  setBulkMenuOpen((m) => (m === 'location' ? null : 'location'))
                }
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50 dark:hover:bg-black/10"
              >
                <span aria-hidden>📍</span>
                Set location
              </button>
              <button
                type="button"
                disabled={bulkActionBusy}
                onClick={() =>
                  setBulkMenuOpen((m) => (m === 'connect' ? null : 'connect'))
                }
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50 dark:hover:bg-black/10"
              >
                <span className="text-xs opacity-80" aria-hidden>
                  ——
                </span>
                Connect as…
              </button>
              <div className="h-4 w-px bg-white/20 dark:bg-gray-300" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeIds(new Set())
                  setBulkMenuOpen(null)
                }}
                className="text-sm opacity-50 transition-opacity hover:opacity-100"
              >
                ✕ Clear
              </button>
            </div>
          </div>
        ) : null}
        </div>
      </div>
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
        </>
      ) : (
        <NodesListView
          rows={listRows}
          totalNonSelfCount={totalNonSelfPeople}
          searchQuery={listSearch}
          onSearchChange={setListSearch}
          onSelectPerson={selectPersonFromList}
          sort={listSort}
          onSortChange={setListSort}
          tagsByPersonId={tagsByPersonId}
          tagPillClassName={relationTagPillClass}
        />
      )}
      </div>

      <div
        className="pointer-events-auto fixed bottom-4 z-40 flex flex-col gap-2 sm:flex-row"
        style={{
          right: selectedPerson ? 'calc(288px + 1rem)' : '1rem',
          transition: 'right 250ms ease-in-out',
        }}
      >
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
          onClick={() => {
            setImportAiOpen(true)
          }}
          className="rounded-full border border-zinc-300 bg-background px-4 py-3 text-sm font-medium shadow dark:border-zinc-600"
        >
          Import with AI
        </button>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title="Help & Tutorial"
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-bold leading-none"
            aria-hidden
          >
            ?
          </span>
        </button>
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-full border border-zinc-300 bg-background px-4 py-3 text-sm font-medium shadow dark:border-zinc-600"
        >
          Refresh
        </button>
      </div>

      {showHelp ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHelp(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="starmap-help-title"
            className={[
              'relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl',
              'border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900',
              'transition-all duration-200 ease-out',
              helpModalEntered
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-2 scale-95 opacity-0',
            ].join(' ')}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 text-xl leading-none text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
            >
              ×
            </button>
            <div className="p-6">
              <div className="mb-6 grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
                <span
                  className="flex justify-center text-lg leading-none"
                  aria-hidden
                >
                  ✦
                </span>
                <h2
                  id="starmap-help-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  How to use Starmap
                </h2>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  🧑‍🤝‍🧑
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Adding People
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Click &apos;+ Add Person&apos; to create a node for anyone in your life.
                    Give them a name, then click their node to fill in their profile — birthdays,
                    allergies, favourite things, how you met, and more.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  🔗
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Adding Connections
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Click &apos;+ Add Connection&apos; to draw a line between any two people.
                    Assign relationship tags like Friend, Colleague, or Family, and add an optional
                    note about the connection.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  ✦
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Constellations
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">Create constellations in the left panel (e.g. Work, Family, Close Friends). Use the
                    pencil icon to enter assign mode, then click nodes to add them. Click a
                    name to watch its constellation light up across your graph.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  📍
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Locations
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Add a location to any person&apos;s profile in their side panel. People in the
                    same location are automatically connected by soft constellation lines so you can
                    see where everyone is.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  🖱
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Navigating the Graph
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Drag nodes to rearrange your map — positions are saved automatically. Scroll to
                    zoom in and out. Click any node to open their profile. Click any connection line
                    to view or edit the relationship.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  ⇧
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Shift + Click (Multi-Select)
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Hold Shift and click multiple nodes to select them all at once. A toolbar will
                    appear letting you add them all to a community, set a shared location, or connect
                    them with a relationship type in one action.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  🤖
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Import with AI
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Use the Import with AI button to quickly add people by describing them in natural
                    language. The AI will fill in their profile fields automatically.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  👁
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    List View
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Switch to List View using the toggle in the toolbar to see all your people in a
                    searchable, sortable list. Click any row to open and edit their profile.
                  </p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                <span
                  className="flex shrink-0 items-start justify-center pt-0.5 text-xl leading-none"
                  aria-hidden
                >
                  🔗
                </span>
                <div className="min-w-0">
                  <h3 className="mb-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                    Sharing Your Graph
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Go to your Profile page to get a shareable link to your public graph. Toggle it
                    private anytime from the same page.
                  </p>
                </div>
              </div>

              <p className="mt-6 border-t border-gray-100 pt-4 text-left text-xs text-gray-400 dark:border-gray-800 dark:text-gray-600">
                More features are always being added to Starmap ✦
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {importAiOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-background shadow-xl dark:border-zinc-700">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
              <div>
                <h3 className="text-base font-semibold">Import People with AI</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Paste text or upload a file. We&apos;ll extract people into editable cards before adding them.
                </p>
              </div>
              <button
                type="button"
                className="text-xl leading-none text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                onClick={() => {
                  setImportAiOpen(false)
                  resetImportAi()
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {importAiStage === 'input' ? (
              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">Text input</label>
                  <textarea
                    value={importAiText}
                    onChange={(e) => setImportAiText(e.target.value)}
                    placeholder="Paste anything here: notes, emails, a bio, a meeting recap, etc."
                    rows={10}
                    className="w-full resize-y rounded-xl border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Or upload a file</label>
                  <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                    <input
                      type="file"
                      accept=".csv,.txt,.docx"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (!f) return
                        setImportAiFileName(f.name)
                        setImportAiBusy(true)
                        void (async () => {
                          try {
                            const text = await extractTextFromImportFile(f)
                            setImportAiSourceText(text)
                            showToast('File ready ✓', 'success')
                          } catch (err) {
                            console.error('[import-ai-file]', err)
                            showToast('Could not read that file.', 'error')
                            setImportAiFileName(null)
                            setImportAiSourceText('')
                          } finally {
                            setImportAiBusy(false)
                          }
                        })()
                      }}
                      className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:opacity-90 dark:file:bg-zinc-100 dark:file:text-zinc-900"
                    />
                    {importAiFileName ? (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Selected: <span className="font-medium">{importAiFileName}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
                    onClick={() => {
                      setImportAiOpen(false)
                      resetImportAi()
                    }}
                    disabled={importAiBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                    disabled={importAiBusy}
                    onClick={() => void runGeminiImport()}
                  >
                    {importAiBusy ? 'Parsing…' : 'Extract people'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {importAiPeople.length}
                    </span>{' '}
                    people found.
                  </p>
                  <button
                    type="button"
                    className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
                    onClick={() => setImportAiStage('input')}
                    disabled={importAiBusy}
                  >
                    ← Back to input
                  </button>
                </div>

                <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                  {importAiPeople.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                Name
                              </label>
                              <input
                                value={p.name}
                                onChange={(e) =>
                                  setImportAiPeople((prev) =>
                                    prev.map((x) =>
                                      x.id === p.id ? { ...x, name: e.target.value } : x
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-600"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                Relationship
                              </label>
                              <select
                                value={p.relationship ?? ''}
                                onChange={(e) =>
                                  setImportAiPeople((prev) =>
                                    prev.map((x) =>
                                      x.id === p.id
                                        ? { ...x, relationship: e.target.value || null }
                                        : x
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-600"
                              >
                                <option value="">Unknown</option>
                                {RELATIONSHIP_VALUES.map((r) => (
                                  <option key={r} value={r}>
                                    {relationshipTitle(r)}
                                  </option>
                                ))}
                                <option value="partner">Partner</option>
                                <option value="enemy">Enemy</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                Location
                              </label>
                              <input
                                value={p.location ?? ''}
                                onChange={(e) =>
                                  setImportAiPeople((prev) =>
                                    prev.map((x) =>
                                      x.id === p.id
                                        ? { ...x, location: e.target.value || null }
                                        : x
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-600"
                                placeholder="e.g. Vancouver"
                              />
                            </div>
                            <div />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Things to remember
                            </label>
                            <textarea
                              value={p.things_to_remember ?? ''}
                              onChange={(e) =>
                                setImportAiPeople((prev) =>
                                  prev.map((x) =>
                                    x.id === p.id
                                      ? { ...x, things_to_remember: e.target.value || null }
                                      : x
                                  )
                                )
                              }
                              rows={3}
                              className="w-full resize-y rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-600"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Custom attributes (JSON)
                            </label>
                            <textarea
                              value={p.custom_attributes_text}
                              onChange={(e) =>
                                setImportAiPeople((prev) =>
                                  prev.map((x) =>
                                    x.id === p.id
                                      ? { ...x, custom_attributes_text: e.target.value }
                                      : x
                                  )
                                )
                              }
                              rows={4}
                              className="w-full resize-y rounded-lg border border-zinc-300 bg-background px-3 py-2 font-mono text-xs dark:border-zinc-600"
                              placeholder='e.g. {"birthday":"1998-03-15","instagram":"@handle"}'
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          onClick={() =>
                            setImportAiPeople((prev) => prev.filter((x) => x.id !== p.id))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
                    onClick={() => {
                      setImportAiOpen(false)
                      resetImportAi()
                    }}
                    disabled={importAiBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                    disabled={importAiBusy || importAiPeople.length === 0}
                    onClick={() => void addImportedPeopleToGraph()}
                  >
                    {importAiBusy ? 'Adding…' : 'Add to Graph'}
                  </button>
                </div>
              </div>
            )}
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
            <label className="mt-3 block text-sm font-medium">Constellation (optional)</label>
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
            <label className="mt-3 block text-sm font-medium">Constellation (optional)</label>
            <select
              value={pendingCommunityId ?? ''}
              onChange={(e) =>
                setPendingCommunityId(normalizeCommunityId(e.target.value || null))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              <option value="">No constellation</option>
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
          <label className="mt-3 block text-sm font-medium">Constellation (optional)</label>
          <select
            value={selectedEdgeCommunityId ?? ''}
            onChange={(e) => {
              const next = normalizeCommunityId(e.target.value || null)
              setSelectedEdgeCommunityId(next)
              void updateSelectedEdgePair({ community_id: next })
            }}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
          >
            <option value="">No constellation</option>
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
        saveStatus={saveStatus}
        onPanelNameBlur={() => void handlePanelNameBlur()}
        panelErr={panelErr}
        panelSaving={panelSaving}
        onSave={() => void savePanelExplicit()}
        saveLabel={creatingDraftNode ? 'Save New Node' : 'Save Changes'}
        canDelete={Boolean(selectedPerson && !selectedPerson.is_self)}
        onDelete={() => void deletePerson()}
      >
        {selectedPerson ? (
          <>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-gray-400">
                Location
              </label>
              <input
                value={panelLocName}
                onChange={(e) => setPanelLocName(e.target.value)}
                onBlur={() => void handlePanelLocationBlur()}
                placeholder="e.g. Vancouver"
                className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
              />
            </div>
            {!selectedPerson.is_self ? (
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-gray-400">
                  Relationship to You
                </label>
                <div className="max-h-24 overflow-y-auto rounded-md">
                  <div className="flex flex-wrap gap-1.5 pr-0.5">
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
                </div>
                {panelRelationTags.join(', ') !== loadedRelationTagsKey ? (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Note (optional)
                    </label>
                    <input
                      value={panelRelationNote}
                      onChange={(e) => setPanelRelationNote(e.target.value)}
                      placeholder="e.g. met at conference"
                      className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-gray-400">
                Things to remember
              </label>
              <textarea
                value={panelNotes}
                onChange={(e) => setPanelNotes(e.target.value)}
                rows={panelNotesFocused ? 4 : 2}
                onFocus={() => setPanelNotesFocused(true)}
                onBlur={() => {
                  setPanelNotesFocused(false)
                  void saveThingsToRememberWithHistory()
                }}
                className="w-full resize-y border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setRememberHistoryOpen((v) => !v)}
              >
                <span className="text-xs uppercase tracking-widest text-gray-400">
                  Things to Remember — Edit History
                </span>
                <span className="shrink-0 text-xs text-gray-400">
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
                        <div
                          key={entry.id}
                          className="rounded border border-zinc-200 p-2 dark:border-zinc-700"
                        >
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
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-widest text-gray-400">
                  Custom attributes
                </span>
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
              <div className="space-y-1">
                {(customAttrsShowAll
                  ? panelRows
                  : panelRows.slice(0, 3)
                ).map((row, rowIndex) => (
                  <div key={rowIndex} className="flex gap-1.5">
                    <input
                      className="w-[36%] border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                      value={row.key}
                      onChange={(e) =>
                        setPanelRows((rows) =>
                          rows.map((x, j) =>
                            j === rowIndex ? { ...x, key: e.target.value } : x
                          )
                        )
                      }
                      onBlur={() => void persistCustomAttributesBlur()}
                    />
                    <div className="min-w-0 flex-1">
                      <SmartAttributeField
                        attrKey={row.key}
                        value={row.value}
                        onChange={(next) =>
                          setPanelRows((rows) =>
                            rows.map((x, j) =>
                              j === rowIndex ? { ...x, value: next } : x
                            )
                          )
                        }
                        onSave={() => void persistCustomAttributesBlur()}
                        allAttributes={panelAttributesMap}
                      />
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-zinc-500"
                      onClick={() =>
                        setPanelRows((rows) =>
                          rows.filter((_, j) => j !== rowIndex).length === 0
                            ? [{ key: '', value: '' }]
                            : rows.filter((_, j) => j !== rowIndex)
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {panelRows.length > 3 && !customAttrsShowAll ? (
                <button
                  type="button"
                  className="mt-1.5 text-xs text-blue-600 underline hover:underline dark:text-blue-400"
                  onClick={() => setCustomAttrsShowAll(true)}
                >
                  Show {panelRows.length - 3} more
                </button>
              ) : null}
              {panelRows.length > 3 && customAttrsShowAll ? (
                <button
                  type="button"
                  className="mt-1.5 text-xs text-blue-600 underline dark:text-blue-400"
                  onClick={() => setCustomAttrsShowAll(false)}
                >
                  Show less
                </button>
              ) : null}
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-widest text-gray-400">
                Communities
              </p>
              {selectedNodeCommunities.length === 0 ? (
                <p className="text-xs text-zinc-400">No communities yet</p>
              ) : (
                <div className="max-h-16 overflow-y-auto">
                  <div className="flex flex-wrap gap-1.5">
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
                          className="text-xs leading-none"
                          onClick={() =>
                            void toggleNodeCommunityMembership(
                              selectedPerson.id,
                              c.id
                            )
                          }
                          aria-label={`Remove from ${c.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
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
                className="mt-2 w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
              >
                <option value="">+ Add to community</option>
                {availableCommunitiesForSelectedNode.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setPhotosSectionOpen((v) => !v)}
              >
                <span className="text-xs uppercase tracking-widest text-gray-400">
                  Photos
                  {galleryPhotoCount > 0
                    ? ` · ${galleryPhotoCount} photo${galleryPhotoCount === 1 ? '' : 's'}`
                    : ''}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {photosSectionOpen ? '▾' : '▸'}
                </span>
              </button>
              {photosSectionOpen ? (
                <div className="mt-2">
                  <NodePhotoGallery
                    supabase={supabase}
                    nodeId={selectedPerson.id}
                    disabled={
                      creatingDraftNode ||
                      selectedPerson.id.startsWith('__draft__')
                    }
                    refreshKey={photoGalleryRefresh}
                    onPrimaryAvatarChange={onGalleryPrimaryAvatarChange}
                    onPhotosCountChange={setGalleryPhotoCount}
                  />
                </div>
              ) : null}
            </div>
            {!selectedPerson.is_self ? (
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setRelationshipHistoryOpen((v) => !v)}
                >
                  <span className="text-xs uppercase tracking-widest text-gray-400">
                    Relationship history
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {relationshipHistoryOpen ? '▾' : '▸'}
                  </span>
                </button>
                {relationshipHistoryOpen ? (
                  <>
                    <p className="mt-1 text-xs text-zinc-500">
                      Changes to “relation to you”, newest first.
                    </p>
                    {relationHistory.length === 0 ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        No changes recorded yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 border-l-2 border-zinc-200 pl-2 text-xs dark:border-zinc-700">
                        {relationHistory.map((row) => (
                          <li key={row.id}>
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
                  </>
                ) : null}
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-xs uppercase tracking-widest text-gray-400">
                Connections
              </p>
              <p className="text-xs text-zinc-500">Existing links for this person.</p>
              <ul className="mt-2 space-y-1 text-xs">
                {(connectionsShowAll
                  ? panelDedupedConnections
                  : panelDedupedConnections.slice(0, 4)
                ).map((e) => {
                  const oid =
                    e.source_node_id === selectedPerson.id
                      ? e.target_node_id
                      : e.source_node_id
                  const other = people.find((p) => p.id === oid)
                  return (
                    <li
                      key={pairKey(e.source_node_id, e.target_node_id)}
                      className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-700"
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
              {panelDedupedConnections.length > 4 && !connectionsShowAll ? (
                <button
                  type="button"
                  className="mt-1.5 text-xs text-blue-600 underline dark:text-blue-400"
                  onClick={() => setConnectionsShowAll(true)}
                >
                  Show all ({panelDedupedConnections.length})
                </button>
              ) : null}
              {panelDedupedConnections.length > 4 && connectionsShowAll ? (
                <button
                  type="button"
                  className="mt-1.5 text-xs text-blue-600 underline dark:text-blue-400"
                  onClick={() => setConnectionsShowAll(false)}
                >
                  Show less
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </NodeDetailPanel>

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

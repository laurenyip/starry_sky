'use client'

import { useToast } from '@/components/toast-provider'
import { CommunityRegionsLayer } from '@/components/friend-graph/community-regions-layer'
import { ConstellationNode } from '@/components/friend-graph/constellation-node'
import { LabeledEdge } from '@/components/friend-graph/labeled-edge'
import { PersonNode } from '@/components/friend-graph/person-node'
import { CONNECTION_LABEL_PRESETS } from '@/lib/connection-presets'
import {
  edgesForPersonDeduped,
  pairKey,
} from '@/lib/edge-helpers'
import {
  buildFlowElements,
  type DbEdge,
  type DbLocation,
  type DbPerson,
} from '@/lib/flow-build'
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
  if (missingTable || missingColumn || missingV4 || missingV5) {
    return [
      'Database schema is out of date: run the SQL in your Supabase project (SQL Editor):',
      'repo file supabase/fix_add_locations_and_node_columns.sql',
      'and for communities / node avatars: supabase/migration_v4_social_constellations_avatars.sql',
      'and for profile avatar column: supabase/migration_v5_profiles_avatar_url.sql',
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

  const [socialConstellations, setSocialConstellations] = useState<
    { id: string; name: string; user_id: string; color_index: number }[]
  >([])
  const [nodeConstellationRows, setNodeConstellationRows] = useState<
    { node_id: string; constellation_id: string }[]
  >([])

  const [connSearch, setConnSearch] = useState('')
  const [newConnOtherId, setNewConnOtherId] = useState('')
  const [newConnLabel, setNewConnLabel] = useState('')
  const [newConstellationName, setNewConstellationName] = useState('')

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
  const [panelConstellationIds, setPanelConstellationIds] = useState<string[]>(
    []
  )
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr, setPanelErr] = useState<string | null>(null)

  const placeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shiftRef = useRef(shiftHeld)
  shiftRef.current = shiftHeld

  const needsForceLayout = useMemo(
    () =>
      people.some(
        (p) =>
          p.position_x == null ||
          p.position_y == null ||
          !Number.isFinite(Number(p.position_x)) ||
          !Number.isFinite(Number(p.position_y))
      ),
    [people]
  )

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      buildFlowElements(locations, people, dbEdges, {
        runForceLayout: needsForceLayout,
        shiftConnect: false,
        highlightPersonId: highlightId,
      }),
    [locations, people, dbEdges, needsForceLayout, highlightId]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
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
      initialNodes.map((n) => {
        if (n.type !== 'person') return n
        const d = n.data as Record<string, unknown>
        return { ...n, data: { ...d, shiftConnect: sh } }
      })
    )
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

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

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [locsRes, nodesRes, edgesRes, consRes, ncRes] = await Promise.all([
      supabase
        .from('locations')
        .select('id,name,user_id')
        .eq('user_id', userId)
        .order('name'),
      supabase
        .from('nodes')
        .select(
          'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,avatar_url'
        )
        .eq('owner_id', userId),
      supabase
        .from('edges')
        .select('id,owner_id,source_node_id,target_node_id,label')
        .eq('owner_id', userId),
      supabase
        .from('constellations')
        .select('id,name,user_id,color_index')
        .eq('user_id', userId)
        .order('name'),
      supabase.from('node_constellations').select('node_id,constellation_id'),
    ])
    const errs = [
      locsRes.error,
      nodesRes.error,
      edgesRes.error,
      consRes.error,
      ncRes.error,
    ].filter(Boolean) as { message: string }[]
    if (errs.length) {
      setError(
        formatSupabaseSchemaError(errs.map((e) => e.message))
      )
      setLoading(false)
      return
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
    const rawPeople = (nodesRes.data ?? []) as Record<string, unknown>[]
    const ncList = (ncRes.data ?? []) as {
      node_id: string
      constellation_id: string
    }[]
    const ncByNode = new Map<string, string[]>()
    for (const row of ncList) {
      const arr = ncByNode.get(row.node_id) ?? []
      arr.push(row.constellation_id)
      ncByNode.set(row.node_id, arr)
    }
    setPeople(
      rawPeople.map((r) => ({
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
        avatar_url: r.avatar_url ? String(r.avatar_url) : null,
        constellation_ids: ncByNode.get(String(r.id)) ?? [],
      }))
    )
    setDbEdges(
      (edgesRes.data ?? []).map((e) => ({
        id: e.id as string,
        source_node_id: e.source_node_id as string,
        target_node_id: e.target_node_id as string,
        label: String(e.label ?? 'friend'),
      }))
    )
    setSocialConstellations(
      (consRes.data ?? []) as {
        id: string
        name: string
        user_id: string
        color_index: number
      }[]
    )
    setNodeConstellationRows(ncList)
    setLoading(false)
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
      setPanelConstellationIds([])
      setConnSearch('')
      setNewConnOtherId('')
      setNewConnLabel('')
      return
    }
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
    setPanelConstellationIds([...(selectedPerson.constellation_ids ?? [])])
    setPanelErr(null)
    setConnSearch('')
    setNewConnOtherId('')
    setNewConnLabel('')
  }, [selectedPerson])

  const nodeIdsByConstellationId = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const row of nodeConstellationRows) {
      if (!m[row.constellation_id]) m[row.constellation_id] = []
      m[row.constellation_id].push(row.node_id)
    }
    return m
  }, [nodeConstellationRows])

  const savePanel = useCallback(async () => {
    if (!selectedPerson) return
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
    const { error: uerr } = await supabase
      .from('nodes')
      .update({
        location_id: panelLocId || null,
        relationship: panelRel,
        things_to_remember: panelNotes,
        custom_attributes: custom,
        ...(pos ? { position_x: pos.x, position_y: pos.y } : {}),
      })
      .eq('id', selectedPerson.id)
      .eq('owner_id', userId)
    if (uerr) {
      setPanelSaving(false)
      setPanelErr(uerr.message)
      return
    }
    await supabase
      .from('node_constellations')
      .delete()
      .eq('node_id', selectedPerson.id)
    if (panelConstellationIds.length > 0) {
      const { error: ncerr } = await supabase.from('node_constellations').insert(
        panelConstellationIds.map((constellation_id) => ({
          node_id: selectedPerson.id,
          constellation_id,
        }))
      )
      if (ncerr) {
        setPanelSaving(false)
        setPanelErr(ncerr.message)
        return
      }
    }
    setPanelSaving(false)
    await loadData()
    setSelectedPerson(null)
  }, [
    selectedPerson,
    panelLocId,
    panelRel,
    panelNotes,
    panelRows,
    panelConstellationIds,
    supabase,
    userId,
    loadData,
  ])

  const deletePerson = useCallback(async () => {
    if (!selectedPerson) return
    setPanelSaving(true)
    await supabase.from('nodes').delete().eq('id', selectedPerson.id).eq('owner_id', userId)
    setPanelSaving(false)
    setSelectedPerson(null)
    await loadData()
  }, [selectedPerson, supabase, userId, loadData])

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
    const { error: e } = await supabase.from('edges').insert([
      {
        owner_id: userId,
        source_node_id: selectedPerson.id,
        target_node_id: newConnOtherId,
        label,
      },
      {
        owner_id: userId,
        source_node_id: newConnOtherId,
        target_node_id: selectedPerson.id,
        label,
      },
    ])
    if (e) {
      setPanelErr(e.message)
      return
    }
    setNewConnOtherId('')
    setNewConnLabel('')
    await loadData()
  }, [
    selectedPerson,
    newConnOtherId,
    newConnLabel,
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

  const createSocialConstellation = useCallback(async () => {
    const name = newConstellationName.trim()
    if (!name) return
    const { data, error: e } = await supabase
      .from('constellations')
      .insert({
        user_id: userId,
        name,
        color_index: socialConstellations.length % 8,
      })
      .select('id')
      .single()
    if (e) {
      setPanelErr(e.message)
      return
    }
    setNewConstellationName('')
    if (data?.id) {
      setPanelConstellationIds((prev) => [...prev, data.id as string])
    }
    await loadData()
  }, [newConstellationName, socialConstellations.length, supabase, userId, loadData])

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!selectedPerson) return
      if (!NODE_IMAGE_TYPES.includes(file.type as (typeof NODE_IMAGE_TYPES)[number])) {
        showToast('Please choose a JPEG, PNG, or WebP image.', 'error')
        return
      }
      const personId = selectedPerson.id
      const ext = mimeToNodeExt(file.type)
      const path = `${userId}/${personId}.${ext}`
      const prevUrl = selectedPerson.avatar_url

      const blobUrl = URL.createObjectURL(file)
      patchPersonAvatar(personId, blobUrl)

      setAvatarUploading(true)
      setPanelErr(null)

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' })

      if (upErr) {
        URL.revokeObjectURL(blobUrl)
        patchPersonAvatar(personId, prevUrl)
        setAvatarUploading(false)
        showToast(upErr.message, 'error')
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

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

    const { data: list } = await supabase.storage.from('avatars').list(userId)
    const match = list?.find((o) => o.name.startsWith(personId))
    if (match) {
      await supabase.storage
        .from('avatars')
        .remove([`${userId}/${match.name}`])
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
    const { error: e } = await supabase.from('edges').insert([
      {
        owner_id: userId,
        source_node_id: pendingConn.source,
        target_node_id: pendingConn.target,
        label,
      },
      {
        owner_id: userId,
        source_node_id: pendingConn.target,
        target_node_id: pendingConn.source,
        label,
      },
    ])
    if (e) setError(e.message)
    setPendingConn(null)
    await loadData()
  }, [pendingConn, dbEdges, supabase, userId, connEdgeLabel, loadData])

  const saveEdgeLabel = useCallback(async () => {
    if (!selectedEdge) return
    const raw = dbEdges.find((d) => d.id === selectedEdge.id)
    if (!raw) return
    const a = raw.source_node_id
    const b = raw.target_node_id
    const label = connEdgeLabel.trim() || 'connected'
    const { error: e1 } = await supabase
      .from('edges')
      .update({ label })
      .eq('owner_id', userId)
      .eq('source_node_id', a)
      .eq('target_node_id', b)
    const { error: e2 } = await supabase
      .from('edges')
      .update({ label })
      .eq('owner_id', userId)
      .eq('source_node_id', b)
      .eq('target_node_id', a)
    if (e1 || e2) setError((e1 ?? e2)?.message ?? 'Update failed')
    setSelectedEdge(null)
    await loadData()
  }, [selectedEdge, dbEdges, supabase, userId, connEdgeLabel, loadData])

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
    setSelectedEdge(null)
    await loadData()
  }, [selectedEdge, dbEdges, supabase, userId, loadData])

  const schedulePersistPosition = useCallback(
    (id: string, x: number, y: number) => {
      if (placeTimer.current) clearTimeout(placeTimer.current)
      placeTimer.current = setTimeout(() => {
        void supabase
          .from('nodes')
          .update({ position_x: x, position_y: y })
          .eq('id', id)
          .eq('owner_id', userId)
      }, 400)
    },
    [supabase, userId]
  )

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return
    if (c.source === c.target) return
    setConnEdgeLabel('friends')
    setPendingConn({ source: c.source, target: c.target })
  }, [])

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== 'person') return
      const { x, y } = node.position
      schedulePersistPosition(node.id, x, y)

      const fresh = nodesRef.current
      const consts = fresh.filter((n) => n.type === 'constellation')
      const center = personAbsoluteCenter(node, fresh)
      if (!center) return
      const hit = constellationHit(center, consts)
      if (!hit || hit.locationId == null) return

      const currentLoc = people.find((p) => p.id === node.id)?.location_id
      if (hit.id === CONSTELLATION_NODE_ID('unplaced')) return

      if (currentLoc === hit.locationId) return

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
          })
          .eq('id', node.id)
          .eq('owner_id', userId)
        if (uerr) setError(uerr.message)
        await loadData()
      })()
    },
    [people, schedulePersistPosition, supabase, userId, loadData]
  )

  useEffect(() => {
    return () => {
      if (placeTimer.current) clearTimeout(placeTimer.current)
    }
  }, [])

  const hint = (
    <p className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(24rem,calc(100%-1.5rem))] rounded-lg border border-zinc-200/80 bg-background/90 px-3 py-2 text-[11px] text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700 dark:text-zinc-400">
      Hold <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-600">Shift</kbd>{' '}
      and connect handles between people. Drag nodes to rearrange; drop into
      another region to move location. Click an edge to see the relationship on
      the line or edit below.
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
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
          setSelectedEdge(null)
          if (n.type === 'person') {
            const row = people.find((p) => p.id === n.id)
            if (row) setSelectedPerson(row)
          }
        }}
        onPaneClick={() => {
          setSelectedPerson(null)
          setSelectedEdge(null)
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })))
        }}
        onEdgeClick={(_, e) => {
          setEdges((eds) =>
            eds.map((edge) => ({ ...edge, selected: edge.id === e.id }))
          )
          setSelectedEdge(e)
          const raw = dbEdges.find((d) => d.id === e.id)
          setConnEdgeLabel(raw?.label ?? '')
        }}
        onNodeDragStop={onNodeDragStop}
        fitView
        minZoom={0.35}
        maxZoom={1.4}
        className="touch-none h-full w-full bg-zinc-50/50 dark:bg-zinc-950/40"
      >
        <Background gap={22} size={1.2} />
        <CommunityRegionsLayer
          constellations={socialConstellations}
          nodeIdsByConstellationId={nodeIdsByConstellationId}
        />
        <Controls showInteractive={false} />
        <MiniMap
          className="!bg-background/90 dark:!bg-zinc-900/90"
          zoomable
          pannable
          maskColor="rgba(0,0,0,0.12)"
        />
      </ReactFlow>
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
                onClick={() => setPendingConn(null)}
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
          <div className="flex items-start justify-between border-b p-4 dark:border-zinc-800">
            <div className="flex gap-3">
              <label className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                {selectedPerson.avatar_url ? (
                  <Image
                    src={selectedPerson.avatar_url}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold">
                    {selectedPerson.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                )}
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
              <div>
                <h2 className="text-xl font-semibold leading-tight">
                  {selectedPerson.name}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Your relationship to them (category)
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-2xl text-zinc-500"
              onClick={() => setSelectedPerson(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-sm font-medium">Profile photo</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {avatarUploading
                  ? 'Uploading…'
                  : 'Tap the avatar above to choose JPEG, PNG, or WebP.'}
              </p>
              {selectedPerson.avatar_url ? (
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
            <div>
              <label className="text-sm font-medium">Location</label>
              <select
                value={panelLocId}
                onChange={(e) => setPanelLocId(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
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
                    onClick={() => setPanelRel(r)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
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
            <div>
              <label className="text-sm font-medium">Things to remember</label>
              <textarea
                value={panelNotes}
                onChange={(e) => setPanelNotes(e.target.value)}
                rows={5}
                className="mt-1 w-full resize-y rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Custom attributes</span>
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
                      className="w-[36%] rounded-md border px-2 py-1 text-sm dark:border-zinc-600"
                      value={row.key}
                      onChange={(e) =>
                        setPanelRows((rows) =>
                          rows.map((x, j) =>
                            j === i ? { ...x, key: e.target.value } : x
                          )
                        )
                      }
                    />
                    <input
                      className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm dark:border-zinc-600"
                      value={row.value}
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
              <p className="text-sm font-medium">Communities (constellations)</p>
              <p className="text-xs text-zinc-500">
                Group people across locations; shown as soft regions on the graph.
              </p>
              <div className="mt-2 flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                {socialConstellations.length === 0 ? (
                  <p className="text-xs text-zinc-500">None yet — create one below.</p>
                ) : (
                  socialConstellations.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={panelConstellationIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPanelConstellationIds((prev) => [...prev, c.id])
                          } else {
                            setPanelConstellationIds((prev) =>
                              prev.filter((id) => id !== c.id)
                            )
                          }
                        }}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={newConstellationName}
                  onChange={(e) => setNewConstellationName(e.target.value)}
                  placeholder="New community name"
                  className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm dark:border-zinc-600"
                />
                <button
                  type="button"
                  className="shrink-0 rounded-md border px-2 py-1.5 text-xs dark:border-zinc-600"
                  onClick={() => void createSocialConstellation()}
                >
                  + Create
                </button>
              </div>
            </div>
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
                className="mt-2 w-full rounded-md border px-3 py-1.5 text-sm dark:border-zinc-600"
              />
              <select
                value={newConnOtherId}
                onChange={(e) => setNewConnOtherId(e.target.value)}
                className="mt-2 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
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
                className="mt-2 w-full rounded-md border px-3 py-1.5 text-sm dark:border-zinc-600"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {CONNECTION_LABEL_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] dark:border-zinc-600"
                    onClick={() => setNewConnLabel(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-md border border-zinc-300 py-1.5 text-sm dark:border-zinc-600"
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
          <div className="border-t p-4 dark:border-zinc-800 space-y-2">
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
              className="w-full rounded-md border border-red-200 py-2 text-sm text-red-700 dark:border-red-900"
              onClick={() => void deletePerson()}
            >
              Delete person
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  )
}

'use client'

import { NodeDetailPanel } from '@/components/friend-graph/node-detail-panel'
import { ConstellationOverlay } from '@/components/friend-graph/constellation-overlay'
import { LabeledEdge } from '@/components/friend-graph/labeled-edge'
import { PersonNode } from '@/components/friend-graph/person-node'
import { createClient } from '@/lib/supabase'
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type DirectoryNodeRow = {
  id: string
  directory_id: string
  name: string
  avatar_url: string | null
  photo_url: string | null
  location: string | null
  cohort: string | null
  relationship: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_discord: string | null
  contact_linkedin: string | null
  contact_instagram: string | null
  custom_attributes: Record<string, unknown> | null
  canvas_x: number | null
  canvas_y: number | null
}
type DirectoryEdgeRow = {
  id: string
  directory_id: string
  source_id: string
  target_id: string
  label: string | null
}
type DirectoryConstellationRow = {
  id: string
  directory_id: string
  name: string
  type: 'location' | 'cohort'
}
type DirectoryNodeConstellationRow = {
  directory_id: string
  node_id: string
  constellation_id: string
}

const nodeTypes = { person: PersonNode }
const edgeTypes = { labeled: LabeledEdge }

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

function personDisplayInitial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join(':')
}

export function SharedGraphWorkspace(props: {
  directoryId: string
  refreshToken: number
  searchQuery: string
  viewMode: 'graph' | 'list'
  onLoadedName?: (name: string) => void
  backgroundColor?: string
  overlayImageUrl?: string | null
  overlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  overlayOpacity?: number
  overlaySize?: number
  customFields?: string[]
  groupingLabel1?: string
  groupingLabel2?: string
  onImportFromMyGraph?: () => void
  onImportWithAI?: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const shiftHeld = useShiftHeld()
  const [rows, setRows] = useState<DirectoryNodeRow[]>([])
  const [edgesRows, setEdgesRows] = useState<DirectoryEdgeRow[]>([])
  const [constellations, setConstellations] = useState<DirectoryConstellationRow[]>([])
  const [memberships, setMemberships] = useState<DirectoryNodeConstellationRow[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<DirectoryNodeRow | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [activeConstellation, setActiveConstellation] = useState<string | null>(null)
  const [activeConstellationName, setActiveConstellationName] = useState<string | null>(null)
  const [panelDraft, setPanelDraft] = useState<DirectoryNodeRow | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr, setPanelErr] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pendingConn, setPendingConn] = useState<Connection | null>(null)
  const [pendingLabel, setPendingLabel] = useState('')
  const [selectedEdgeLabel, setSelectedEdgeLabel] = useState('')
  const [locationDraft, setLocationDraft] = useState('')
  const [editingConstellationId, setEditingConstellationId] = useState<string | null>(null)
  const [editingConstellationName, setEditingConstellationName] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const sidePanelRef = useRef<HTMLDivElement | null>(null)
  const [sideArrowTop, setSideArrowTop] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [dirRes, nodesRes, edgesRes, cRes, mRes, locRes] = await Promise.all([
      supabase.from('directories').select('name').eq('id', props.directoryId).maybeSingle(),
      supabase.from('directory_nodes').select('*').eq('directory_id', props.directoryId),
      supabase.from('directory_edges').select('*').eq('directory_id', props.directoryId),
      supabase.from('directory_constellations').select('*').eq('directory_id', props.directoryId),
      supabase.from('directory_node_constellations').select('*').eq('directory_id', props.directoryId),
      supabase.from('locations').select('name').order('name'),
    ])
    if (props.onLoadedName && dirRes.data?.name) props.onLoadedName(dirRes.data.name)
    const nextRows = ((nodesRes.data as DirectoryNodeRow[]) ?? []).map((r, idx) => {
      const x = r.canvas_x ?? 0
      const y = r.canvas_y ?? 0
      if (x === 0 && y === 0) {
        return {
          ...r,
          canvas_x: (idx % 6) * 220 + 100,
          canvas_y: Math.floor(idx / 6) * 180 + 100,
        }
      }
      return r
    })
    for (const row of nextRows) {
      if ((row.canvas_x ?? 0) !== 0 || (row.canvas_y ?? 0) !== 0) continue
      await supabase
        .from('directory_nodes')
        .update({ canvas_x: row.canvas_x, canvas_y: row.canvas_y })
        .eq('id', row.id)
        .eq('directory_id', props.directoryId)
    }
    setRows(nextRows)
    setEdgesRows((edgesRes.data as DirectoryEdgeRow[]) ?? [])
    setConstellations((cRes.data as DirectoryConstellationRow[]) ?? [])
    setMemberships((mRes.data as DirectoryNodeConstellationRow[]) ?? [])
    setLocations(((locRes.data ?? []) as { name: string }[]).map((l) => l.name))
  }, [props.directoryId, props.onLoadedName, supabase])

  useEffect(() => {
    void load()
  }, [load, props.refreshToken])

  useEffect(() => {
    if (!selectedNode) {
      setPanelDraft(null)
      setLocationDraft('')
      return
    }
    setPanelDraft({ ...selectedNode })
    setLocationDraft(selectedNode.location ?? '')
    setPanelErr(null)
    setSaveStatus('idle')
  }, [selectedNode])

  useEffect(() => {
    if (!selectedEdge) {
      setSelectedEdgeLabel('')
      return
    }
    const row = edgesRows.find((e) => e.id === selectedEdge.id)
    setSelectedEdgeLabel(row?.label ?? '')
  }, [selectedEdge, edgesRows])

  const matched = useMemo(() => {
    const q = props.searchQuery.trim().toLowerCase()
    if (!q) return new Set(rows.map((r) => r.id))
    return new Set(rows.filter((r) => r.name.toLowerCase().includes(q)).map((r) => r.id))
  }, [props.searchQuery, rows])

  const activeMemberIds = useMemo(() => {
    if (activeConstellationName) {
      const matchingConstellationIds = new Set(
        constellations
          .filter((c) => c.name === activeConstellationName)
          .map((c) => c.id)
      )
      return new Set(
        memberships
          .filter((m) => matchingConstellationIds.has(m.constellation_id))
          .map((m) => m.node_id)
      )
    }
    if (!activeConstellation) return null
    return new Set(
      memberships
        .filter((m) => m.constellation_id === activeConstellation)
        .map((m) => m.node_id)
    )
  }, [activeConstellation, activeConstellationName, constellations, memberships])

  const locationConstellations = useMemo(
    () =>
      constellations
        .filter((c) => c.type === 'location')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [constellations]
  )
  const cohortConstellations = useMemo(
    () =>
      constellations
        .filter((c) => c.type === 'cohort')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [constellations]
  )
  const constellationPairs = useMemo(() => {
    if (!activeMemberIds) return [] as { source: string; target: string }[]
    const ids = [...activeMemberIds]
    if (ids.length < 2) return []
    if (ids.length <= 18) {
      const pairs: { source: string; target: string }[] = []
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) pairs.push({ source: ids[i]!, target: ids[j]! })
      }
      return pairs
    }
    const sorted = [...ids].sort((a, b) => a.localeCompare(b))
    const pairs: { source: string; target: string }[] = []
    for (let i = 0; i < sorted.length - 1; i++) pairs.push({ source: sorted[i]!, target: sorted[i + 1]! })
    return pairs
  }, [activeMemberIds])

  const rfNodes = useMemo<Node[]>(() => {
    return rows.map((r) => {
      const inSearch = matched.has(r.id)
      const inConst = activeMemberIds ? activeMemberIds.has(r.id) : true
      return {
        id: r.id,
        type: 'person',
        position: { x: r.canvas_x ?? 0, y: r.canvas_y ?? 0 },
        data: {
          name: r.name,
          relationship: r.relationship ?? 'friend',
          avatarUrl: r.avatar_url ?? r.photo_url ?? null,
          selectedInPanel: selectedNode?.id === r.id,
          panelFocused: selectedNode?.id === r.id,
          communityMemberGlowHex:
            activeMemberIds && activeMemberIds.has(r.id) ? '#a78bfa' : null,
          constellationMode: Boolean(activeMemberIds),
          shiftConnect: shiftHeld,
        },
        style: { opacity: inSearch && inConst ? 1 : 0.12 },
      } as Node
    })
  }, [rows, matched, activeMemberIds, selectedNode?.id, shiftHeld])

  const rfEdges = useMemo<Edge[]>(() => {
    const ids = new Set(rows.map((r) => r.id))
    return edgesRows
      .filter((e) => ids.has(e.source_id) && ids.has(e.target_id))
      .filter((e) => e.source_id !== e.target_id)
      .filter(
        (e, i, all) =>
          all.findIndex((x) => pairKey(x.source_id, x.target_id) === pairKey(e.source_id, e.target_id)) ===
          i
      )
      .map((e) => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: 'labeled',
        selectable: true,
        data: {
          displayName: e.label ?? '',
          tooltip: e.label ?? '',
          baseStroke: '#9ca3af',
          communityKey: '',
        },
        style: { stroke: '#9ca3af', strokeWidth: 1.05, opacity: 0.55 },
      }))
  }, [edgesRows, rows])

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)
  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes])
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges])

  const syncConstellations = useCallback(
    async (inputRows?: DirectoryNodeRow[]) => {
      let sourceRows = inputRows
      if (!sourceRows) {
        const { data: freshRows } = await supabase
          .from('directory_nodes')
          .select('*')
          .eq('directory_id', props.directoryId)
        sourceRows = (freshRows as DirectoryNodeRow[] | null) ?? []
      }
      await supabase
        .from('directory_node_constellations')
        .delete()
        .eq('directory_id', props.directoryId)
      await supabase
        .from('directory_constellations')
        .delete()
        .eq('directory_id', props.directoryId)

      const groups = new Map<string, string[]>()
      for (const node of sourceRows) {
        const location = String(node.location ?? '').trim()
        const cohort = String(node.cohort ?? '').trim()
        if (location) groups.set(`location:${location}`, [...(groups.get(`location:${location}`) ?? []), node.id])
        if (cohort) groups.set(`cohort:${cohort}`, [...(groups.get(`cohort:${cohort}`) ?? []), node.id])
      }
      if (groups.size === 0) {
        setConstellations([])
        setMemberships([])
        return
      }

      const inserts = Array.from(groups.keys()).map((key) => {
        const [type, name] = key.split(':')
        return { directory_id: props.directoryId, name, type }
      })
      const { data: created } = await supabase
        .from('directory_constellations')
        .insert(inserts)
        .select('id,name,type')
      const createdRows = (created as DirectoryConstellationRow[] | null) ?? []
      const idByKey = new Map(createdRows.map((row) => [`${row.type}:${row.name}`, row.id]))
      const links: DirectoryNodeConstellationRow[] = []
      for (const [key, ids] of groups.entries()) {
        const constellationId = idByKey.get(key)
        if (!constellationId) continue
        for (const nodeId of ids) {
          links.push({
            directory_id: props.directoryId,
            node_id: nodeId,
            constellation_id: constellationId,
          })
        }
      }
      if (links.length > 0) {
        await supabase.from('directory_node_constellations').insert(links)
      }
      setConstellations(createdRows)
      setMemberships(links)
    },
    [props.directoryId, supabase]
  )

  const saveNode = useCallback(async () => {
    if (!panelDraft) return
    setPanelSaving(true)
    setSaveStatus('saving')
    setPanelErr(null)
    const { error } = await supabase
      .from('directory_nodes')
      .update({
        name: panelDraft.name,
        location: locationDraft || null,
        cohort: panelDraft.cohort ?? null,
        contact_email: panelDraft.contact_email ?? null,
        contact_phone: panelDraft.contact_phone ?? null,
        contact_discord: panelDraft.contact_discord ?? null,
        contact_linkedin: panelDraft.contact_linkedin ?? null,
        contact_instagram: panelDraft.contact_instagram ?? null,
        custom_attributes: panelDraft.custom_attributes ?? {},
      })
      .eq('id', panelDraft.id)
      .eq('directory_id', props.directoryId)
    if (error) {
      setPanelErr(error.message)
      setSaveStatus('error')
      setPanelSaving(false)
      return
    }
    await load()
    await syncConstellations()
    setSaveStatus('saved')
    setPanelSaving(false)
  }, [panelDraft, locationDraft, supabase, props.directoryId, load, syncConstellations])

  const deleteNode = useCallback(async () => {
    if (!selectedNode) return
    setPanelSaving(true)
    await supabase.from('directory_node_constellations').delete().eq('node_id', selectedNode.id).eq('directory_id', props.directoryId)
    await supabase.from('directory_edges').delete().eq('source_id', selectedNode.id).eq('directory_id', props.directoryId)
    await supabase.from('directory_edges').delete().eq('target_id', selectedNode.id).eq('directory_id', props.directoryId)
    await supabase.from('directory_nodes').delete().eq('id', selectedNode.id).eq('directory_id', props.directoryId)
    setPanelSaving(false)
    setSelectedNode(null)
    await load()
    await syncConstellations()
  }, [selectedNode, props.directoryId, supabase, load, syncConstellations])

  const createDraftNode = useCallback(() => {
    setSelectedEdge(null)
    setLocationDraft('')
    setSelectedNode({
      id: `__draft__-${Date.now()}`,
      directory_id: props.directoryId,
      name: 'New person',
      avatar_url: null,
      photo_url: null,
      location: null,
      cohort: null,
      relationship: null,
      contact_email: null,
      contact_phone: null,
      contact_discord: null,
      contact_linkedin: null,
      contact_instagram: null,
      custom_attributes: {},
      canvas_x: 130,
      canvas_y: 130,
    })
  }, [props.directoryId])

  const saveDraftNode = useCallback(async () => {
    if (!panelDraft || !panelDraft.id.startsWith('__draft__')) return
    setPanelSaving(true)
    const { error } = await supabase.from('directory_nodes').insert({
      directory_id: props.directoryId,
      name: panelDraft.name.trim() || 'Unnamed',
      location: locationDraft || null,
      cohort: panelDraft.cohort || null,
      contact_email: panelDraft.contact_email || null,
      contact_phone: panelDraft.contact_phone || null,
      contact_discord: panelDraft.contact_discord || null,
      contact_linkedin: panelDraft.contact_linkedin || null,
      contact_instagram: panelDraft.contact_instagram || null,
      custom_attributes: panelDraft.custom_attributes ?? {},
      canvas_x: panelDraft.canvas_x ?? 130,
      canvas_y: panelDraft.canvas_y ?? 130,
    })
    setPanelSaving(false)
    if (error) {
      setPanelErr(error.message)
      return
    }
    await load()
    await syncConstellations()
    setSelectedNode(null)
  }, [panelDraft, locationDraft, supabase, props.directoryId, load, syncConstellations])

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!panelDraft || panelDraft.id.startsWith('__draft__')) return
      setAvatarUploading(true)
      setPanelErr(null)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) {
        setPanelErr(sessionError?.message ?? 'Please sign in again before uploading.')
        setAvatarUploading(false)
        return
      }
      const preferredPath = `directory/${props.directoryId}/${panelDraft.id}`
      const fallbackPath = `${session.user.id}/directory/${props.directoryId}/${panelDraft.id}`
      let successfulPath: string | null = null
      const firstUpload = await supabase.storage
        .from('avatars')
        .upload(preferredPath, file, { upsert: true })
      if (!firstUpload.error) {
        successfulPath = preferredPath
      } else {
        const secondUpload = await supabase.storage
          .from('avatars')
          .upload(fallbackPath, file, { upsert: true })
        if (!secondUpload.error) {
          successfulPath = fallbackPath
        } else {
          setPanelErr(
            `Avatar upload failed: ${secondUpload.error.message || firstUpload.error.message}`
          )
          setAvatarUploading(false)
          return
        }
      }
      if (!successfulPath) {
        setPanelErr('Avatar upload failed.')
        setAvatarUploading(false)
        return
      }
      const pub = supabase.storage.from('avatars').getPublicUrl(successfulPath)
      const url = `${pub.data.publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('directory_nodes')
        .update({ avatar_url: url })
        .eq('id', panelDraft.id)
        .eq('directory_id', props.directoryId)
      if (updateError) {
        setPanelErr(`Avatar saved but profile update failed: ${updateError.message}`)
        setAvatarUploading(false)
        return
      }
      setAvatarUploading(false)
      await load()
      setPanelDraft((prev) => (prev ? { ...prev, avatar_url: url } : prev))
    },
    [panelDraft, props.directoryId, supabase, load]
  )

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    setPendingConn(c)
    setPendingLabel('')
  }, [])

  const commitPendingConnection = useCallback(async () => {
    if (!pendingConn?.source || !pendingConn.target) return
    const payload = {
      directory_id: props.directoryId,
      source_id: pendingConn.source,
      target_id: pendingConn.target,
      label: pendingLabel.trim() || null,
    }
    await supabase.from('directory_edges').insert(payload)
    setPendingConn(null)
    await load()
  }, [pendingConn, pendingLabel, props.directoryId, supabase, load])

  const updateSelectedEdgeLabel = useCallback(async () => {
    if (!selectedEdge) return
    await supabase
      .from('directory_edges')
      .update({ label: selectedEdgeLabel.trim() || null })
      .eq('id', selectedEdge.id)
      .eq('directory_id', props.directoryId)
    await load()
  }, [selectedEdge, selectedEdgeLabel, props.directoryId, supabase, load])

  const deleteSelectedEdge = useCallback(async () => {
    if (!selectedEdge) return
    await supabase.from('directory_edges').delete().eq('id', selectedEdge.id).eq('directory_id', props.directoryId)
    setSelectedEdge(null)
    await load()
  }, [selectedEdge, props.directoryId, supabase, load])

  const startRenameConstellation = useCallback((id: string, current: string) => {
    setEditingConstellationId(id)
    setEditingConstellationName(current)
  }, [])

  const saveRenameConstellation = useCallback(
    async (id: string) => {
      const next = editingConstellationName.trim()
      if (!next) return
      await supabase
        .from('directory_constellations')
        .update({ name: next })
        .eq('id', id)
        .eq('directory_id', props.directoryId)
      setEditingConstellationId(null)
      setEditingConstellationName('')
      await load()
    },
    [editingConstellationName, props.directoryId, supabase, load]
  )

  const removeConstellation = useCallback(
    async (id: string) => {
      await supabase
        .from('directory_node_constellations')
        .delete()
        .eq('constellation_id', id)
        .eq('directory_id', props.directoryId)
      await supabase
        .from('directory_constellations')
        .delete()
        .eq('id', id)
        .eq('directory_id', props.directoryId)
      if (activeConstellation === id) setActiveConstellation(null)
      if (editingConstellationId === id) {
        setEditingConstellationId(null)
        setEditingConstellationName('')
      }
      await load()
    },
    [props.directoryId, supabase, activeConstellation, editingConstellationId, load]
  )

  const onNodeDragStop = useCallback(
    async (_: unknown, node: Node) => {
      if (node.type !== 'person') return
      setRows((prev) =>
        prev.map((r) =>
          r.id === node.id ? { ...r, canvas_x: node.position.x, canvas_y: node.position.y } : r
        )
      )
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void supabase
          .from('directory_nodes')
          .update({ canvas_x: Math.round(node.position.x), canvas_y: Math.round(node.position.y) })
          .eq('id', node.id)
          .eq('directory_id', props.directoryId)
      }, 350)
    },
    [props.directoryId, supabase]
  )

  const listRows = useMemo(
    () =>
      rows
        .filter((r) => matched.has(r.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [rows, matched]
  )

  const locationSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const loc of locations) {
      const next = String(loc ?? '').trim()
      if (next) set.add(next)
    }
    for (const row of rows) {
      const next = String(row.location ?? '').trim()
      if (next) set.add(next)
    }
    for (const c of locationConstellations) {
      const next = String(c.name ?? '').trim()
      if (next) set.add(next)
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [locations, rows, locationConstellations])
  const locationOptions = useMemo(() => {
    const set = new Set(locationSuggestions)
    const current = String(locationDraft ?? '').trim()
    if (current) set.add(current)
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [locationSuggestions, locationDraft])

  const cohortSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      const next = String(row.cohort ?? '').trim()
      if (next) set.add(next)
    }
    for (const c of cohortConstellations) {
      const next = String(c.name ?? '').trim()
      if (next) set.add(next)
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [rows, cohortConstellations])

  const extraAttrKeys = useMemo(
    () =>
      Array.from(
        new Set([...(props.customFields ?? []), ...Object.keys(panelDraft?.custom_attributes ?? {})])
      ),
    [props.customFields, panelDraft?.custom_attributes]
  )

  const actionButtonClass =
    'rounded-full border border-zinc-300 bg-background px-4 py-3 text-sm font-medium shadow dark:border-zinc-600'

  useEffect(() => {
    const updateArrowPosition = () => {
      const workspace = workspaceRef.current
      const panel = sidePanelRef.current
      if (!workspace || !panel || !showLeftPanel) {
        setSideArrowTop(null)
        return
      }
      const workspaceRect = workspace.getBoundingClientRect()
      const panelRect = panel.getBoundingClientRect()
      const workspaceHeight = workspaceRect.height
      const panelHeight = panelRect.height
      const panelCenterFromWorkspaceTop =
        panelRect.top - workspaceRect.top + panelHeight / 2
      const resolvedTop =
        panelHeight > workspaceHeight ? workspaceHeight / 2 : panelCenterFromWorkspaceTop
      setSideArrowTop(resolvedTop)
    }

    updateArrowPosition()
    window.addEventListener('resize', updateArrowPosition)
    return () => {
      window.removeEventListener('resize', updateArrowPosition)
    }
  }, [showLeftPanel, locationConstellations.length, cohortConstellations.length])

  if (props.viewMode === 'list') {
    return (
      <div className="h-full overflow-y-auto rounded-xl border border-zinc-200 bg-background p-3 dark:border-zinc-800">
        {listRows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedNode(r)}
            className="mb-2 flex w-full items-center gap-3 rounded-md border border-zinc-200 p-2 text-left dark:border-zinc-700"
          >
            <div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              {r.avatar_url ?? r.photo_url ? (
                <img
                  src={r.avatar_url ?? r.photo_url ?? ''}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {r.location ?? 'No location'} · {r.cohort ?? 'No cohort'}
              </p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  const renderConstellationRow = (
    c: DirectoryConstellationRow,
    dotClass: string,
    showTypeLabel: boolean
  ) => {
    const isEditing = editingConstellationId === c.id
    return (
      <div
        key={c.id}
        className={`rounded-lg px-2 py-1.5 transition-colors ${
          activeConstellation === c.id || activeConstellationName === c.name
            ? 'bg-zinc-200/80 dark:bg-zinc-700/80'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-1 w-7 shrink-0 rounded-full ${dotClass}`} />
          {isEditing ? (
            <input
              value={editingConstellationName}
              onChange={(e) => setEditingConstellationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveRenameConstellation(c.id)
                if (e.key === 'Escape') {
                  setEditingConstellationId(null)
                  setEditingConstellationName('')
                }
              }}
              className="min-w-0 flex-1 rounded border border-zinc-300 bg-background px-1.5 py-0.5 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700"
              autoFocus
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm">
              {c.name}
              {showTypeLabel ? <span className="ml-1 opacity-70">({c.type})</span> : null}
            </span>
          )}
          <button
            type="button"
            title="View constellation"
            className="cursor-pointer rounded px-1 text-xs transition-colors hover:bg-white/10 dark:hover:bg-white/10"
            onClick={() => {
              setActiveConstellation(null)
              setActiveConstellationName((prev) => (prev === c.name ? null : c.name))
            }}
          >
            👁
          </button>
          <button
            type="button"
            title="Edit constellation"
            className="cursor-pointer rounded px-1 text-xs transition-colors hover:bg-white/10 dark:hover:bg-white/10"
            onClick={() =>
              isEditing
                ? void saveRenameConstellation(c.id)
                : startRenameConstellation(c.id, c.name)
            }
          >
            ✏️
          </button>
          <button
            type="button"
            title="Delete constellation"
            className="cursor-pointer rounded px-1 text-xs transition-colors hover:bg-white/10 dark:hover:bg-white/10"
            onClick={() => void removeConstellation(c.id)}
          >
            🗑
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-[24rem] min-w-0 flex-1 flex-col">
      <div ref={workspaceRef} className="relative flex h-full min-h-0 min-w-0 flex-1">
        {showLeftPanel ? (
          <div
            ref={sidePanelRef}
            className="pointer-events-auto absolute left-3 top-3 z-20 w-56 rounded-xl border border-zinc-200 bg-background/95 p-3 shadow-lg dark:border-zinc-800"
          >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {props.groupingLabel1 || 'Locations'}
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {locationConstellations.map((c) =>
                  renderConstellationRow(c, 'bg-violet-400/80', true)
                )}
              </div>
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {props.groupingLabel2 || 'Constellations'}
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {cohortConstellations.map((c) =>
                  renderConstellationRow(c, 'bg-pink-400/80', false)
                )}
              </div>
          </div>
        ) : null}
        <button
          type="button"
          aria-label={showLeftPanel ? 'Hide communities and locations panel' : 'Show communities and locations panel'}
          aria-expanded={showLeftPanel}
          onClick={() => setShowLeftPanel((prev) => !prev)}
          className={`absolute z-20 -translate-y-1/2 cursor-pointer rounded-r-lg border border-gray-200 bg-white px-1 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 ${
            showLeftPanel ? 'left-[15.5rem]' : 'left-0 top-1/2'
          }`}
          style={
            showLeftPanel && sideArrowTop != null ? { top: `${sideArrowTop}px` } : undefined
          }
        >
          {showLeftPanel ? '‹' : '›'}
        </button>
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: props.backgroundColor || '#0a0a0f' }}
        />
        {props.overlayImageUrl ? (
          <img
            src={props.overlayImageUrl}
            alt=""
            className={`pointer-events-none absolute z-[5] object-contain ${
              (props.overlayPosition ?? 'center') === 'top-left'
                ? 'left-5 top-5'
                : (props.overlayPosition ?? 'center') === 'top-right'
                  ? 'right-5 top-5'
                  : (props.overlayPosition ?? 'center') === 'bottom-left'
                    ? 'left-5 bottom-5'
                    : (props.overlayPosition ?? 'center') === 'bottom-right'
                      ? 'right-5 bottom-5'
                      : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
            }`}
            style={{
              opacity: props.overlayOpacity ?? 0.15,
              width: `${props.overlaySize ?? 128}px`,
              height: `${props.overlaySize ?? 128}px`,
            }}
          />
        ) : null}
        <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1">
          <ReactFlowProvider>
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
              nodesConnectable={shiftHeld}
              elementsSelectable
              onNodeClick={(_, n) => {
                const row = rows.find((r) => r.id === n.id)
                if (!row) return
                setSelectedEdge(null)
                setSelectedNode(row)
              }}
              onPaneClick={() => {
                setSelectedEdge(null)
                setSelectedNode(null)
                setActiveConstellation(null)
                setActiveConstellationName(null)
              }}
              onEdgeClick={(_, e) => {
                setSelectedNode(null)
                setSelectedEdge(e)
              }}
              onNodeDragStop={onNodeDragStop}
              fitView
              minZoom={0.35}
              maxZoom={1.4}
              className="touch-none h-full w-full"
              style={{ background: 'transparent' }}
            >
              <Background gap={22} size={1.2} />
              {activeMemberIds && constellationPairs.length > 0 ? (
                <ConstellationOverlay
                  memberIds={[...activeMemberIds]}
                  pairs={constellationPairs}
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
          </ReactFlowProvider>
        </div>
      </div>

      <div
        className="pointer-events-auto fixed bottom-4 z-40 flex flex-col gap-2 sm:flex-row"
        style={{
          right: selectedNode ? 'calc(288px + 1rem)' : '1rem',
          transition: 'right 250ms ease-in-out',
        }}
      >
        <button
          type="button"
          onClick={createDraftNode}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-lg"
        >
          Add Person
        </button>
        <button
          type="button"
          onClick={props.onImportFromMyGraph}
          className={actionButtonClass}
        >
          Import from My Graph
        </button>
        <button
          type="button"
          onClick={props.onImportWithAI}
          className={actionButtonClass}
        >
          Import with AI
        </button>
      </div>

      {pendingConn ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingConn(null)
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-background p-4 shadow-xl dark:border-zinc-700">
            <h3 className="font-semibold">New connection</h3>
            <label className="mt-3 block text-sm font-medium">Label (optional)</label>
            <input
              value={pendingLabel}
              onChange={(e) => setPendingLabel(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md bg-foreground py-2 text-sm text-background"
                onClick={() => void commitPendingConnection()}
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
          <label className="mt-3 block text-sm font-medium">Label</label>
          <input
            value={selectedEdgeLabel}
            onChange={(e) => setSelectedEdgeLabel(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
              onClick={() => void updateSelectedEdgeLabel()}
            >
              Save label
            </button>
            <button
              type="button"
              className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:text-red-300"
              onClick={() => void deleteSelectedEdge()}
            >
              Delete
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
              onClick={() => setSelectedEdge(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative z-[60]">
      <NodeDetailPanel
        open={Boolean(panelDraft)}
        node={panelDraft}
        onClose={() => setSelectedNode(null)}
        topOffsetClass="top-28"
        avatarPickerActive={false}
        setAvatarPickerActive={() => undefined}
        avatarUploading={avatarUploading}
        uploadNodePhoto={(f) => void uploadAvatar(f)}
        panelName={panelDraft?.name ?? ''}
        setPanelName={(v) => setPanelDraft((prev) => (prev ? { ...prev, name: v } : prev))}
        personDisplayInitial={personDisplayInitial}
        panelRelationTags={[]}
        relationTagPillClass={() => ''}
        saveStatus={saveStatus}
        panelErr={panelErr}
        panelSaving={panelSaving}
        onSave={() =>
          panelDraft?.id.startsWith('__draft__') ? void saveDraftNode() : void saveNode()
        }
        saveLabel={panelDraft?.id.startsWith('__draft__') ? 'Save New Node' : 'Save Changes'}
        canDelete={Boolean(panelDraft && !panelDraft.id.startsWith('__draft__'))}
        onDelete={() => void deleteNode()}
      >
        {panelDraft ? (
          <>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-gray-400">
                {props.groupingLabel1 || 'Locations'}
              </label>
              <select
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Select a location</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-gray-400">
                {props.groupingLabel2 || 'Constellations'}
              </label>
              <input
                value={panelDraft.cohort ?? ''}
                list="directory-cohort-suggestions"
                onChange={(e) =>
                  setPanelDraft((prev) => (prev ? { ...prev, cohort: e.target.value } : prev))
                }
                className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
              />
              <datalist id="directory-cohort-suggestions">
                {cohortSuggestions.map((cohort) => (
                  <option key={cohort} value={cohort} />
                ))}
              </datalist>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-widest text-gray-400">
                Contact Information
              </p>
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-500">Email</label>
                  <input
                    value={panelDraft.contact_email ?? ''}
                    onChange={(e) =>
                      setPanelDraft((prev) =>
                        prev ? { ...prev, contact_email: e.target.value } : prev
                      )
                    }
                    className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-500">Phone</label>
                  <input
                    value={panelDraft.contact_phone ?? ''}
                    onChange={(e) =>
                      setPanelDraft((prev) =>
                        prev ? { ...prev, contact_phone: e.target.value } : prev
                      )
                    }
                    className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-500">Discord</label>
                  <input
                    value={panelDraft.contact_discord ?? ''}
                    onChange={(e) =>
                      setPanelDraft((prev) =>
                        prev ? { ...prev, contact_discord: e.target.value } : prev
                      )
                    }
                    className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-500">LinkedIn</label>
                  <input
                    value={panelDraft.contact_linkedin ?? ''}
                    onChange={(e) =>
                      setPanelDraft((prev) =>
                        prev ? { ...prev, contact_linkedin: e.target.value } : prev
                      )
                    }
                    className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-500">Instagram</label>
                  <input
                    value={panelDraft.contact_instagram ?? ''}
                    onChange={(e) =>
                      setPanelDraft((prev) =>
                        prev ? { ...prev, contact_instagram: e.target.value } : prev
                      )
                    }
                    className="w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm text-zinc-500">
                Custom attributes
              </p>
              <div className="space-y-1">
                {extraAttrKeys.map((k) => (
                  <div key={k}>
                    <label className="mb-1 block text-sm text-zinc-500">{k}</label>
                    <input
                      value={String((panelDraft.custom_attributes ?? {})[k] ?? '')}
                      onChange={(e) =>
                        setPanelDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                custom_attributes: {
                                  ...(prev.custom_attributes ?? {}),
                                  [k]: e.target.value,
                                },
                              }
                            : prev
                        )
                      }
                      className="block w-full border-b border-gray-300 bg-transparent px-1 py-1 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </NodeDetailPanel>
      </div>
    </div>
  )
}


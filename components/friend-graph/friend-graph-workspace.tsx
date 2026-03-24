'use client'

import { ConstellationNode } from '@/components/friend-graph/constellation-node'
import { LabeledEdge } from '@/components/friend-graph/labeled-edge'
import { PersonNode } from '@/components/friend-graph/person-node'
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
  if (missingTable || missingColumn) {
    return [
      'Database schema is out of date: run the SQL in your Supabase project (SQL Editor):',
      'repo file supabase/fix_add_locations_and_node_columns.sql',
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

function FriendGraphInner({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}) {
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
  const [connRelationship, setConnRelationship] =
    useState<RelationshipKind>('friend')

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
    const [locsRes, nodesRes, edgesRes] = await Promise.all([
      supabase
        .from('locations')
        .select('id,name,user_id')
        .eq('user_id', userId)
        .order('name'),
      supabase
        .from('nodes')
        .select(
          'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y'
        )
        .eq('owner_id', userId),
      supabase
        .from('edges')
        .select('id,owner_id,source_node_id,target_node_id,label')
        .eq('owner_id', userId),
    ])
    const errs = [locsRes.error, nodesRes.error, edgesRes.error].filter(
      Boolean
    ) as { message: string }[]
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
    setPanelErr(null)
  }, [selectedPerson])

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
    setPanelSaving(false)
    if (uerr) {
      setPanelErr(uerr.message)
      return
    }
    await loadData()
    setSelectedPerson(null)
  }, [
    selectedPerson,
    panelLocId,
    panelRel,
    panelNotes,
    panelRows,
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
        (e.source_node_id === pendingConn.source &&
          e.target_node_id === pendingConn.target) ||
        (e.source_node_id === pendingConn.target &&
          e.target_node_id === pendingConn.source)
    )
    if (exists) {
      setPendingConn(null)
      return
    }
    const { error: e } = await supabase.from('edges').insert({
      owner_id: userId,
      source_node_id: pendingConn.source,
      target_node_id: pendingConn.target,
      label: connRelationship,
    })
    if (e) setError(e.message)
    setPendingConn(null)
    await loadData()
  }, [pendingConn, dbEdges, supabase, userId, connRelationship, loadData])

  const saveEdgeLabel = useCallback(async () => {
    if (!selectedEdge) return
    const { error: e } = await supabase
      .from('edges')
      .update({ label: connRelationship })
      .eq('id', selectedEdge.id)
      .eq('owner_id', userId)
    if (e) setError(e.message)
    setSelectedEdge(null)
    await loadData()
  }, [selectedEdge, supabase, userId, connRelationship, loadData])

  const deleteEdge = useCallback(async () => {
    if (!selectedEdge) return
    await supabase
      .from('edges')
      .delete()
      .eq('id', selectedEdge.id)
      .eq('owner_id', userId)
    setSelectedEdge(null)
    await loadData()
  }, [selectedEdge, supabase, userId, loadData])

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
    setConnRelationship('friend')
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
      another region to move location. Click an edge to edit the relationship.
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
          if (n.type === 'person') {
            const row = people.find((p) => p.id === n.id)
            if (row) setSelectedPerson(row)
          }
        }}
        onPaneClick={() => {
          setSelectedPerson(null)
          setSelectedEdge(null)
        }}
        onEdgeClick={(_, e) => {
          setSelectedEdge(e)
          const raw = dbEdges.find((d) => d.id === e.id)
          setConnRelationship(
            raw && RELATIONSHIP_VALUES.includes(raw.label as RelationshipKind)
              ? (raw.label as RelationshipKind)
              : 'friend'
          )
        }}
        onNodeDragStop={onNodeDragStop}
        fitView
        minZoom={0.35}
        maxZoom={1.4}
        className="touch-none h-full w-full bg-zinc-50/50 dark:bg-zinc-950/40"
      >
        <Background gap={22} size={1.2} />
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
              How are they connected?
            </p>
            <select
              value={connRelationship}
              onChange={(e) =>
                setConnRelationship(e.target.value as RelationshipKind)
              }
              className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
            >
              {RELATIONSHIP_VALUES.map((r) => (
                <option key={r} value={r}>
                  {relationshipTitle(r)}
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
          <select
            value={connRelationship}
            onChange={(e) =>
              setConnRelationship(e.target.value as RelationshipKind)
            }
            className="mt-2 w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-600"
          >
            {RELATIONSHIP_VALUES.map((r) => (
              <option key={r} value={r}>
                {relationshipTitle(r)}
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
              onClick={() => setSelectedEdge(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {selectedPerson ? (
        <aside className="fixed right-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-background shadow-2xl dark:border-zinc-800">
          <div className="flex items-start justify-between border-b p-4 dark:border-zinc-800">
            <div>
              <h2 className="text-xl font-semibold">{selectedPerson.name}</h2>
              <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold dark:bg-zinc-700">
                {selectedPerson.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
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
              <p className="text-sm font-medium">Connected people</p>
              <ul className="mt-2 space-y-2 text-sm">
                {dbEdges
                  .filter(
                    (e) =>
                      e.source_node_id === selectedPerson.id ||
                      e.target_node_id === selectedPerson.id
                  )
                  .map((e) => {
                    const oid =
                      e.source_node_id === selectedPerson.id
                        ? e.target_node_id
                        : e.source_node_id
                    const other = people.find((p) => p.id === oid)
                    return (
                      <li
                        key={e.id}
                        className="flex justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 dark:border-zinc-700"
                      >
                        <span>{other?.name ?? oid}</span>
                        <span className="text-zinc-500">
                          {relationshipTitle(e.label)}
                        </span>
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

'use client'

import { createClient } from '@/lib/supabase'
import {
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'

type DirectoryNodeRow = {
  id: string
  directory_id: string
  name: string
  avatar_url: string | null
  photo_url: string | null
  birthday: string | null
  location: string | null
  cohort: string | null
  interests: string | null
  discord: string | null
  email: string | null
  things_to_remember: string | null
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
  name: string
  type: 'location' | 'cohort'
}

type DirectoryNodeConstellationRow = {
  node_id: string
  constellation_id: string
}

type NodeData = {
  name: string
  avatarUrl: string | null
  selected: boolean
  faded: boolean
}

type ConstellationNodeData = {
  name: string
  type: 'location' | 'cohort'
  highlighted: boolean
}

function PersonCircleNode(props: NodeProps<Node<NodeData>>) {
  const { data } = props
  const initial = (data.name || '?').slice(0, 1).toUpperCase()
  return (
    <div
      className={`relative h-14 w-14 overflow-hidden rounded-full border bg-zinc-100 dark:bg-zinc-800 ${
        data.selected
          ? 'border-violet-400 ring-4 ring-violet-400/35'
          : 'border-zinc-300 dark:border-zinc-700'
      } ${data.faded ? 'opacity-30' : 'opacity-100'}`}
    >
      {data.avatarUrl ? (
        <img src={data.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {initial}
        </span>
      )}
    </div>
  )
}

function ConstellationBoundaryNode(props: NodeProps<Node<ConstellationNodeData>>) {
  const { data, width = 200, height = 120 } = props
  return (
    <div
      className={`pointer-events-none rounded-[100px] border transition ${
        data.highlighted
          ? 'border-violet-400/70 bg-violet-500/10'
          : 'border-zinc-400/30 bg-zinc-500/5'
      }`}
      style={{ width, height }}
    />
  )
}

function DirectoryEdge(props: EdgeProps<Edge<{ label?: string; active?: boolean }>>) {
  const { id, sourceX, sourceY, targetX, targetY, data } = props
  const [path, centerX, centerY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: '#9ca3af', strokeWidth: 1.05, opacity: 0.55 }} />
      {data?.active && data.label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded-md border border-zinc-300 bg-background px-2 py-1 text-xs text-zinc-700 shadow dark:border-zinc-700 dark:text-zinc-300"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${centerX}px,${centerY}px)`,
              pointerEvents: 'none',
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const DIRECTORY_NODE_TYPES = {
  person: PersonCircleNode,
  constellation: ConstellationBoundaryNode,
}

const DIRECTORY_EDGE_TYPES = {
  directoryEdge: DirectoryEdge,
}

function buildGridFallbackPositions(ids: string[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < ids.length; i += 1) {
    out.set(ids[i], {
      x: (i % 6) * 220 + 100,
      y: Math.floor(i / 6) * 180 + 100,
    })
  }
  return out
}

function distSq(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function Content(props: {
  directoryId: string
  refreshToken: number
  onLoadedName?: (name: string) => void
  backgroundColor?: string
  overlayImageUrl?: string | null
  overlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  overlayOpacity?: number
  customFields?: string[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<DirectoryNodeRow[]>([])
  const [edgesRows, setEdgesRows] = useState<DirectoryEdgeRow[]>([])
  const [constellations, setConstellations] = useState<DirectoryConstellationRow[]>([])
  const [memberships, setMemberships] = useState<DirectoryNodeConstellationRow[]>([])
  const [activeConstellation, setActiveConstellation] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [panelDraft, setPanelDraft] = useState<DirectoryNodeRow | null>(null)

  const constellationById = useMemo(
    () => new Map(constellations.map((c) => [c.id, c])),
    [constellations]
  )
  const nodesInActiveConstellation = useMemo(() => {
    if (!activeConstellation) return new Set<string>()
    return new Set(
      memberships
        .filter((m) => m.constellation_id === activeConstellation)
        .map((m) => m.node_id)
    )
  }, [activeConstellation, memberships])

  const persistPositions = useCallback(
    async (nodes: Node[]) => {
      const updates = nodes
        .filter((n) => n.type === 'person')
        .map((n) => ({
          id: n.id,
          canvas_x: Math.round(n.position.x),
          canvas_y: Math.round(n.position.y),
        }))
      for (const u of updates) {
        await supabase
          .from('directory_nodes')
          .update({ canvas_x: u.canvas_x, canvas_y: u.canvas_y })
          .eq('id', u.id)
          .eq('directory_id', props.directoryId)
      }
    },
    [props.directoryId, supabase]
  )

  const buildConstellationBoundaries = useCallback(
    (people: DirectoryNodeRow[]): Node[] => {
      const byConstellation = new Map<string, DirectoryNodeRow[]>()
      for (const m of memberships) {
        const node = people.find((n) => n.id === m.node_id)
        if (!node) continue
        const arr = byConstellation.get(m.constellation_id) ?? []
        arr.push(node)
        byConstellation.set(m.constellation_id, arr)
      }

      const out: Node[] = []
      for (const [constellationId, members] of byConstellation.entries()) {
        if (members.length === 0) continue
        const xs = members.map((n) => n.canvas_x ?? 0)
        const ys = members.map((n) => n.canvas_y ?? 0)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const padding = 70
        const width = Math.max(220, maxX - minX + padding * 2)
        const height = Math.max(140, maxY - minY + padding * 2)
        const c = constellationById.get(constellationId)
        if (!c) continue
        out.push({
          id: `constellation-${constellationId}`,
          type: 'constellation',
          position: { x: minX - padding, y: minY - padding },
          draggable: false,
          selectable: false,
          data: {
            name: c.name,
            type: c.type,
            highlighted: activeConstellation === c.id,
          } satisfies ConstellationNodeData,
          style: { width, height, zIndex: 0 },
        })
      }
      return out
    },
    [activeConstellation, constellationById, memberships]
  )

  const rebuildConstellations = useCallback(
    async (people: DirectoryNodeRow[]) => {
      await supabase.from('directory_node_constellations').delete().eq('directory_id', props.directoryId)
      await supabase.from('directory_constellations').delete().eq('directory_id', props.directoryId)

      const groups = new Map<string, string[]>()
      for (const p of people) {
        const location = (p.location ?? '').trim()
        const cohort = (p.cohort ?? '').trim()
        if (location) groups.set(`location:${location}`, [...(groups.get(`location:${location}`) ?? []), p.id])
        if (cohort) groups.set(`cohort:${cohort}`, [...(groups.get(`cohort:${cohort}`) ?? []), p.id])
      }

      const inserts = Array.from(groups.keys()).map((k) => {
        const [type, name] = k.split(':')
        return { directory_id: props.directoryId, name, type }
      })
      if (inserts.length === 0) {
        setConstellations([])
        setMemberships([])
        return
      }

      const { data: inserted } = await supabase
        .from('directory_constellations')
        .insert(inserts)
        .select('id,name,type')
      const list = (inserted as DirectoryConstellationRow[]) ?? []
      const idByKey = new Map(list.map((c) => [`${c.type}:${c.name}`, c.id]))
      const links: Array<{ directory_id: string; node_id: string; constellation_id: string }> = []
      for (const [key, nodeIds] of groups.entries()) {
        const cid = idByKey.get(key)
        if (!cid) continue
        for (const nodeId of nodeIds) {
          links.push({ directory_id: props.directoryId, node_id: nodeId, constellation_id: cid })
        }
      }
      if (links.length) {
        await supabase.from('directory_node_constellations').insert(links)
      }
      setConstellations(list)
      setMemberships(links.map((l) => ({ node_id: l.node_id, constellation_id: l.constellation_id })))
    },
    [props.directoryId, supabase]
  )

  const autoWire = useCallback(
    async (people: DirectoryNodeRow[]) => {
      if (people.length < 2) return
      await supabase.from('directory_edges').delete().eq('directory_id', props.directoryId)
      const degree = new Map<string, number>(people.map((p) => [p.id, 0]))
      const used = new Set<string>()
      const positionById = new Map(
        people.map((p) => [p.id, { x: p.canvas_x ?? 0, y: p.canvas_y ?? 0 }])
      )

      const edgeRows: Array<{ directory_id: string; source_id: string; target_id: string }> = []
      const keyOf = (a: string, b: string) => [a, b].sort().join(':')

      for (const p of people) {
        const nearby = people
          .filter((q) => q.id !== p.id)
          .map((q) => ({
            id: q.id,
            d: distSq(positionById.get(p.id)!, positionById.get(q.id)!),
          }))
          .sort((a, b) => a.d - b.d)

        for (const q of nearby) {
          if ((degree.get(p.id) ?? 0) >= 2) break
          if ((degree.get(q.id) ?? 0) >= 2) continue
          const key = keyOf(p.id, q.id)
          if (used.has(key)) continue
          used.add(key)
          degree.set(p.id, (degree.get(p.id) ?? 0) + 1)
          degree.set(q.id, (degree.get(q.id) ?? 0) + 1)
          edgeRows.push({ directory_id: props.directoryId, source_id: p.id, target_id: q.id })
        }
      }
      if (edgeRows.length) await supabase.from('directory_edges').insert(edgeRows)
    },
    [props.directoryId, supabase]
  )

  const load = useCallback(async () => {
    const [dirRes, nodesRes, edgesRes, cRes, mRes] = await Promise.all([
      supabase.from('directories').select('name').eq('id', props.directoryId).maybeSingle(),
      supabase.from('directory_nodes').select('*').eq('directory_id', props.directoryId),
      supabase.from('directory_edges').select('*').eq('directory_id', props.directoryId),
      supabase
        .from('directory_constellations')
        .select('id,name,type')
        .eq('directory_id', props.directoryId),
      supabase
        .from('directory_node_constellations')
        .select('node_id,constellation_id')
        .eq('directory_id', props.directoryId),
    ])
    if (props.onLoadedName && dirRes.data?.name) props.onLoadedName(dirRes.data.name)

    let people = (nodesRes.data as DirectoryNodeRow[]) ?? []
    const noPositionIds = people
      .filter((p) => (p.canvas_x ?? 0) === 0 && (p.canvas_y ?? 0) === 0)
      .map((p) => p.id)
    if (noPositionIds.length > 0) {
      const spread = buildGridFallbackPositions(noPositionIds)
      for (const person of people) {
        const pos = spread.get(person.id)
        if (!pos) continue
        person.canvas_x = pos.x
        person.canvas_y = pos.y
        await supabase
          .from('directory_nodes')
          .update({ canvas_x: pos.x, canvas_y: pos.y })
          .eq('id', person.id)
          .eq('directory_id', props.directoryId)
      }
    }

    setRows(people)
    setEdgesRows((edgesRes.data as DirectoryEdgeRow[]) ?? [])
    setConstellations((cRes.data as DirectoryConstellationRow[]) ?? [])
    setMemberships((mRes.data as DirectoryNodeConstellationRow[]) ?? [])
  }, [props.directoryId, props.onLoadedName, supabase])

  useEffect(() => {
    void load()
  }, [load, props.refreshToken])

  useEffect(() => {
    if (props.refreshToken <= 0) return
    void (async () => {
      const fresh = (await supabase.from('directory_nodes').select('*').eq('directory_id', props.directoryId))
        .data as DirectoryNodeRow[] | null
      const people = fresh ?? []
      await autoWire(people)
      await rebuildConstellations(people)
      await load()
    })()
  }, [autoWire, rebuildConstellations, load, props.refreshToken, props.directoryId, supabase])

  const rfPersonNodes = useMemo<Node[]>(() => {
    return rows.map((row) => {
      const inActive = activeConstellation
        ? nodesInActiveConstellation.has(row.id)
        : true
      const faded = activeConstellation ? !inActive : false
      return {
        id: row.id,
        type: 'person',
        position: { x: row.canvas_x ?? 0, y: row.canvas_y ?? 0 },
        data: {
          name: row.name,
          avatarUrl: row.avatar_url ?? row.photo_url,
          selected: selectedNodeId === row.id,
          faded,
        } satisfies NodeData,
        draggable: true,
        selectable: false,
        style: { zIndex: 10 },
      }
    })
  }, [rows, activeConstellation, nodesInActiveConstellation, selectedNodeId])

  const rfConstellationNodes = useMemo(() => buildConstellationBoundaries(rows), [buildConstellationBoundaries, rows])

  const rfEdges = useMemo<Edge[]>(() => {
    const nodeIdSet = new Set(rows.map((r) => r.id))
    return edgesRows.flatMap((e) => {
      if (!nodeIdSet.has(e.source_id) || !nodeIdSet.has(e.target_id)) {
        console.warn('[DirectoryCanvas] Edge references missing node', {
          edgeId: e.id,
          source: e.source_id,
          target: e.target_id,
        })
        return []
      }
      return [{
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: 'directoryEdge',
        selectable: false,
        data: {
          label: e.label ?? '',
          active: selectedEdgeId === e.id && Boolean(e.label),
        },
        style: { zIndex: 3 },
      }]
    })
  }, [edgesRows, rows, selectedEdgeId])

  const [nodes, setNodes, onNodesChange] = useNodesState([...rfConstellationNodes, ...rfPersonNodes])
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  useEffect(() => setNodes([...rfConstellationNodes, ...rfPersonNodes]), [rfConstellationNodes, rfPersonNodes, setNodes])
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges])

  const selectedNode = useMemo(
    () => rows.find((n) => n.id === selectedNodeId) ?? null,
    [rows, selectedNodeId]
  )

  useEffect(() => setPanelDraft(selectedNode ? { ...selectedNode } : null), [selectedNode])

  return (
    <div className="relative min-h-0 h-full w-full flex-1">
      <div className="absolute left-3 top-3 z-20 w-56 rounded-xl border border-zinc-200 bg-background/95 p-3 dark:border-zinc-800">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Constellations</h3>
        <button
          type="button"
          className="mb-2 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
          onClick={() => setActiveConstellation(null)}
        >
          Clear highlight
        </button>
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {constellations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                setActiveConstellation((prev) => (prev === c.id ? null : c.id))
              }
              className={`w-full rounded-md px-2 py-1 text-left text-xs ${
                activeConstellation === c.id
                  ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {c.name} <span className="opacity-70">({c.type})</span>
            </button>
          ))}
        </div>
      </div>

      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onMove={() => setSelectedEdgeId((prev) => prev)}
          onNodeClick={(_, node) => {
            if (node.type !== 'person') return
            setSelectedNodeId(node.id)
            setSelectedEdgeId(null)
          }}
          onPaneClick={() => {
            setSelectedNodeId(null)
            setSelectedEdgeId(null)
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id)
            setSelectedNodeId(null)
          }}
          onNodeDragStop={(_, node, allNodes) => {
            if (node.type !== 'person') return
            void persistPositions(allNodes)
            setRows((prev) =>
              prev.map((r) =>
                r.id === node.id
                  ? { ...r, canvas_x: node.position.x, canvas_y: node.position.y }
                  : r
              )
            )
          }}
          nodeTypes={DIRECTORY_NODE_TYPES}
          edgeTypes={DIRECTORY_EDGE_TYPES}
          fitView
          elementsSelectable={false}
          selectionOnDrag={false}
          nodesConnectable={false}
          className="h-full w-full rounded-xl border border-zinc-200 dark:border-zinc-800"
          style={{ background: props.backgroundColor || '#0a0a0f' }}
        >
          <MiniMap />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>

      {props.overlayImageUrl ? (
        <img
          src={props.overlayImageUrl}
          alt=""
          className={`pointer-events-none absolute z-10 h-20 w-20 object-contain ${
            (props.overlayPosition ?? 'top-right') === 'top-left'
              ? 'left-5 top-5'
              : (props.overlayPosition ?? 'top-right') === 'top-right'
                ? 'right-5 top-5'
                : (props.overlayPosition ?? 'top-right') === 'bottom-left'
                  ? 'bottom-5 left-5'
                  : 'bottom-5 right-5'
          }`}
          style={{ opacity: props.overlayOpacity ?? 0.15 }}
        />
      ) : null}

      {panelDraft ? (
        <aside className="absolute right-3 top-3 z-30 w-80 rounded-xl border border-zinc-200 bg-background/95 p-3 shadow-xl dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Node details</h3>
            <button type="button" onClick={() => setSelectedNodeId(null)} className="text-lg leading-none">×</button>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {(['name','birthday','location','cohort','interests','discord','email','things_to_remember'] as const).map((key) => (
              <label key={key} className="block text-xs">
                <span className="mb-1 block text-zinc-500">{key}</span>
                <input
                  value={String((panelDraft as any)[key] ?? '')}
                  onChange={(e) => setPanelDraft((prev) => prev ? { ...prev, [key]: e.target.value } : prev)}
                  className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                />
              </label>
            ))}
            {Array.from(new Set([...(props.customFields ?? []), ...Object.keys(panelDraft.custom_attributes ?? {})])).map((k) => (
              <label key={k} className="block text-xs">
                <span className="mb-1 block text-zinc-500">{k}</span>
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
                  className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!panelDraft) return
              await supabase
                .from('directory_nodes')
                .update({
                  name: panelDraft.name,
                  birthday: panelDraft.birthday,
                  location: panelDraft.location,
                  cohort: panelDraft.cohort,
                  interests: panelDraft.interests,
                  discord: panelDraft.discord,
                  email: panelDraft.email,
                  things_to_remember: panelDraft.things_to_remember,
                  custom_attributes: panelDraft.custom_attributes ?? {},
                })
                .eq('id', panelDraft.id)
                .eq('directory_id', props.directoryId)
              await rebuildConstellations(
                rows.map((r) => (r.id === panelDraft.id ? panelDraft : r))
              )
              await load()
            }}
            className="mt-3 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
        </aside>
      ) : null}
    </div>
  )
}

export function DirectoryCanvas(props: {
  directoryId: string
  refreshToken: number
  onLoadedName?: (name: string) => void
  backgroundColor?: string
  overlayImageUrl?: string | null
  overlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  overlayOpacity?: number
  customFields?: string[]
}) {
  return <Content {...props} />
}


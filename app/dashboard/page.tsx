'use client'

import { LoadingSpinner } from '@/components/loading-spinner'
import { useSupabaseContext } from '@/components/supabase-provider'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ForceGraphProps } from 'react-force-graph-2d'
import type { NodeObject, LinkObject } from 'react-force-graph-2d'

type AttrRow = { key: string; value: string }

type GraphNode = NodeObject<{
  id: string
  name: string
  [key: string]: unknown
}>

type GraphLink = LinkObject<GraphNode, { id: string; label: string | null }>

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
}) as React.ComponentType<
  ForceGraphProps<GraphNode, GraphLink> & {
    ref?: React.Ref<{ zoomToFit: (ms?: number, pad?: number) => void }>
  }
>

function labelColor() {
  if (typeof window === 'undefined') return '#27272a'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? '#d4d4d8'
    : '#27272a'
}

const NODE_PANEL_SKIP = new Set([
  'id',
  'name',
  'x',
  'y',
  'vx',
  'vy',
  'fx',
  'fy',
  'index',
  '__indexColor',
  '__threeObj',
])

function attributesForPanel(node: GraphNode) {
  return Object.fromEntries(
    Object.entries(node).filter(
      ([k]) => !NODE_PANEL_SKIP.has(k) && !k.startsWith('__')
    )
  )
}

function valueToEditString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function rowsFromNodePanelAttrs(node: GraphNode): AttrRow[] {
  const attrs = attributesForPanel(node)
  const entries = Object.entries(attrs)
  if (entries.length === 0) return [{ key: '', value: '' }]
  return entries.map(([k, v]) => ({ key: k, value: valueToEditString(v) }))
}

function attributesFromPanelRows(rows: AttrRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const row of rows) {
    const k = row.key.trim()
    if (!k) continue
    const v = row.value.trim()
    if (
      (v.startsWith('{') && v.endsWith('}')) ||
      (v.startsWith('[') && v.endsWith(']'))
    ) {
      try {
        out[k] = JSON.parse(v) as unknown
        continue
      } catch {
        /* keep as string */
      }
    }
    out[k] = row.value
  }
  return out
}

export default function DashboardPage() {
  const { supabase } = useSupabaseContext()
  const router = useRouter()

  const [graphContainer, setGraphContainer] = useState<HTMLDivElement | null>(
    null
  )
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 })

  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loadingGraph, setLoadingGraph] = useState(true)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[]
    links: GraphLink[]
  }>({ nodes: [], links: [] })

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [linkTip, setLinkTip] = useState<{
    label: string
    x: number
    y: number
  } | null>(null)

  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [attrRows, setAttrRows] = useState<AttrRow[]>([{ key: '', value: '' }])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [connectionModalOpen, setConnectionModalOpen] = useState(false)
  const [personAId, setPersonAId] = useState('')
  const [personBId, setPersonBId] = useState('')
  const [relationshipLabel, setRelationshipLabel] = useState('')
  const [connectionSubmitError, setConnectionSubmitError] = useState<string | null>(
    null
  )
  const [connectionSubmitting, setConnectionSubmitting] = useState(false)

  const [panelSlideOpen, setPanelSlideOpen] = useState(false)
  const [nodePanelRows, setNodePanelRows] = useState<AttrRow[]>([
    { key: '', value: '' },
  ])
  const [panelSaveError, setPanelSaveError] = useState<string | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelDeleting, setPanelDeleting] = useState(false)

  const selectedNodeRef = useRef<GraphNode | null>(null)
  const panelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPanelNodeIdRef = useRef<string | null>(null)

  const graphContainerRef = useCallback((node: HTMLDivElement | null) => {
    setGraphContainer(node)
  }, [])

  useEffect(() => {
    if (!graphContainer) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      const w = Math.max(1, Math.floor(cr.width))
      const h = Math.max(1, Math.floor(cr.height))
      setGraphSize({ width: w, height: h })
    })
    ro.observe(graphContainer)
    return () => ro.disconnect()
  }, [graphContainer])

  useEffect(() => {
    selectedNodeRef.current = selectedNode
  }, [selectedNode])

  useEffect(() => {
    if (!selectedNode) {
      setNodePanelRows([{ key: '', value: '' }])
      return
    }
    setPanelSaveError(null)
    setNodePanelRows(rowsFromNodePanelAttrs(selectedNode))
  }, [selectedNode])

  useEffect(() => {
    if (!selectedNode) {
      prevPanelNodeIdRef.current = null
      setPanelSlideOpen(false)
      return
    }
    const id = String(selectedNode.id)
    const prev = prevPanelNodeIdRef.current
    prevPanelNodeIdRef.current = id

    if (prev === null) {
      setPanelSlideOpen(false)
      const raf = requestAnimationFrame(() => setPanelSlideOpen(true))
      return () => cancelAnimationFrame(raf)
    }
    if (prev !== id) {
      setPanelSlideOpen(true)
    }
  }, [selectedNode])

  useEffect(() => {
    return () => {
      if (panelCloseTimerRef.current)
        clearTimeout(panelCloseTimerRef.current)
    }
  }, [])

  const finishCloseNodePanel = useCallback(() => {
    setSelectedNode(null)
    setPanelSaveError(null)
    panelCloseTimerRef.current = null
  }, [])

  const closeNodePanelAnimated = useCallback((clearLinkTip = true) => {
    if (clearLinkTip) setLinkTip(null)
    if (panelCloseTimerRef.current) {
      clearTimeout(panelCloseTimerRef.current)
      panelCloseTimerRef.current = null
    }
    if (!selectedNodeRef.current) {
      finishCloseNodePanel()
      return
    }
    setPanelSlideOpen(false)
    panelCloseTimerRef.current = setTimeout(finishCloseNodePanel, 300)
  }, [finishCloseNodePanel])

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        setAuthError(error.message)
        setAuthChecked(true)
        return
      }
      if (!user) {
        setAuthChecked(true)
        router.replace('/login')
        return
      }
      setAuthError(null)
      setUserId(user.id)
      setAuthChecked(true)
    })
  }, [supabase, router])

  const loadGraph = useCallback(async () => {
    if (!userId) return
    setLoadingGraph(true)
    setGraphError(null)
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from('nodes').select('id, name, attributes').eq('owner_id', userId),
      supabase
        .from('edges')
        .select('id, source_node_id, target_node_id, label')
        .eq('owner_id', userId),
    ])

    const errs: string[] = []
    if (nodesRes.error) errs.push(nodesRes.error.message)
    if (edgesRes.error) errs.push(edgesRes.error.message)
    if (errs.length) {
      setGraphError(errs.join(' '))
      setGraphData({ nodes: [], links: [] })
      setLoadingGraph(false)
      return
    }

    const rawNodes = nodesRes.data ?? []
    const rawEdges = edgesRes.data ?? []

    const nodes: GraphNode[] = rawNodes.map((n) => {
      const attributes = (n.attributes as Record<string, unknown>) ?? {}
      return {
        id: n.id,
        name: n.name,
        ...attributes,
      }
    })

    const links: GraphLink[] = rawEdges.map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      label: e.label,
    }))

    setGraphData({ nodes, links })
    setLoadingGraph(false)
  }, [supabase, userId])

  useEffect(() => {
    if (!authChecked || !userId) return
    void loadGraph()
  }, [authChecked, userId, loadGraph])

  const fgProps = useMemo<
    ForceGraphProps<GraphNode, GraphLink>
  >(
    () => ({
      graphData,
      nodeId: 'id',
      linkSource: 'source',
      linkTarget: 'target',
      backgroundColor: 'transparent',
      nodeLabel: (n) => String(n.name),
      linkLabel: (l) => (l.label ? String(l.label) : ''),
      nodeCanvasObjectMode: () => 'after',
      nodeCanvasObject: (node, ctx, globalScale) => {
        if (node.x === undefined || node.y === undefined) return
        const fill = labelColor()
        const fontSize = 13 / globalScale
        ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = fill
        ctx.fillText(String(node.name), node.x, node.y + 5 / globalScale)
      },
      linkCanvasObjectMode: () => 'after',
      linkCanvasObject: (link, ctx, globalScale) => {
        const text = link.label
        if (!text) return
        const s = link.source as GraphNode
        const t = link.target as GraphNode
        if (
          s?.x === undefined ||
          s?.y === undefined ||
          t?.x === undefined ||
          t?.y === undefined
        ) {
          return
        }
        const x = (s.x + t.x) / 2
        const y = (s.y + t.y) / 2
        const fs = 11 / globalScale
        ctx.font = `${fs}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = labelColor()
        ctx.fillText(String(text), x, y)
      },
      onNodeClick: (node) => {
        if (panelCloseTimerRef.current) {
          clearTimeout(panelCloseTimerRef.current)
          panelCloseTimerRef.current = null
        }
        setLinkTip(null)
        setSelectedNode(node)
      },
      onLinkClick: (link, event) => {
        closeNodePanelAnimated(false)
        setLinkTip({
          label: link.label ? String(link.label) : 'Connection',
          x: event.clientX,
          y: event.clientY,
        })
      },
      onBackgroundClick: () => {
        closeNodePanelAnimated()
      },
      cooldownTicks: 100,
      linkDirectionalArrowLength: 10,
      linkDirectionalArrowRelPos: 1,
      linkDirectionalArrowColor: () =>
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? '#a1a1aa'
          : '#52525b',
    }),
    [graphData, closeNodePanelAnimated]
  )

  function addAttrRow() {
    setAttrRows((rows) => [...rows, { key: '', value: '' }])
  }

  function updateAttrRow(i: number, field: keyof AttrRow, value: string) {
    setAttrRows((rows) =>
      rows.map((row, j) => (j === i ? { ...row, [field]: value } : row))
    )
  }

  function removeAttrRow(i: number) {
    setAttrRows((rows) => rows.filter((_, j) => j !== i))
  }

  async function handleAddPerson(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSubmitError(null)
    const name = newName.trim()
    if (!name) {
      setSubmitError('Name is required.')
      return
    }

    const attributes: Record<string, string> = {}
    for (const row of attrRows) {
      const k = row.key.trim()
      if (!k) continue
      attributes[k] = row.value
    }

    setSubmitting(true)
    const { error } = await supabase.from('nodes').insert({
      owner_id: userId,
      name,
      attributes,
    })
    setSubmitting(false)

    if (error) {
      setSubmitError(error.message)
      return
    }

    setPersonModalOpen(false)
    setNewName('')
    setAttrRows([{ key: '', value: '' }])
    await loadGraph()
  }

  async function handleAddConnection(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setConnectionSubmitError(null)

    if (!personAId || !personBId) {
      setConnectionSubmitError('Select both people.')
      return
    }
    if (personAId === personBId) {
      setConnectionSubmitError('Person A and Person B must be different.')
      return
    }

    const label = relationshipLabel.trim()
    if (!label) {
      setConnectionSubmitError('Enter a relationship label.')
      return
    }

    setConnectionSubmitting(true)
    const { error } = await supabase.from('edges').insert({
      owner_id: userId,
      source_node_id: personAId,
      target_node_id: personBId,
      label,
    })
    setConnectionSubmitting(false)

    if (error) {
      setConnectionSubmitError(error.message)
      return
    }

    setConnectionModalOpen(false)
    setPersonAId('')
    setPersonBId('')
    setRelationshipLabel('')
    await loadGraph()
  }

  function addNodePanelAttrRow() {
    setNodePanelRows((rows) => [...rows, { key: '', value: '' }])
  }

  function updateNodePanelRow(
    index: number,
    field: keyof AttrRow,
    value: string
  ) {
    setNodePanelRows((rows) =>
      rows.map((row, j) => (j === index ? { ...row, [field]: value } : row))
    )
  }

  function removeNodePanelRow(index: number) {
    setNodePanelRows((rows) => {
      const next = rows.filter((_, j) => j !== index)
      return next.length === 0 ? [{ key: '', value: '' }] : next
    })
  }

  async function handleSaveNodeAttributes() {
    if (!selectedNode || !userId) return
    setPanelSaveError(null)
    setPanelSaving(true)
    const attributes = attributesFromPanelRows(nodePanelRows)
    const { error } = await supabase
      .from('nodes')
      .update({ attributes })
      .eq('id', selectedNode.id)
      .eq('owner_id', userId)
    setPanelSaving(false)
    if (error) {
      setPanelSaveError(error.message)
      return
    }
    setSelectedNode({
      id: selectedNode.id,
      name: selectedNode.name,
      ...attributes,
    } as GraphNode)
    await loadGraph()
  }

  async function handleDeleteNode() {
    if (!selectedNode || !userId) return
    setPanelSaveError(null)
    setPanelDeleting(true)
    const { error } = await supabase
      .from('nodes')
      .delete()
      .eq('id', selectedNode.id)
      .eq('owner_id', userId)
    setPanelDeleting(false)
    if (error) {
      setPanelSaveError(error.message)
      return
    }
    closeNodePanelAnimated()
    await loadGraph()
  }

  if (!authChecked || !userId) {
    if (authError) {
      return (
        <div
          className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-12"
          role="alert"
        >
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Couldn&apos;t verify your session.
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {authError}
          </p>
          <button
            type="button"
            onClick={() => globalThis.location.reload()}
            className="mt-6 self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Retry
          </button>
        </div>
      )
    }
    if (authChecked && !userId) {
      return (
        <div className="flex flex-1 items-center justify-center px-4 text-sm text-zinc-500">
          Redirecting…
        </div>
      )
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <LoadingSpinner className="flex-col gap-3 sm:flex-row" label="Loading…" />
      </div>
    )
  }

  const hasNodes = graphData.nodes.length > 0
  const graphReady = hasNodes && !graphError

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {loadingGraph ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-[2px]">
          <LoadingSpinner
            className="flex-col gap-3 sm:flex-row"
            label="Loading graph…"
          />
        </div>
      ) : null}

      {graphError && !loadingGraph ? (
        <div
          className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-3 dark:border-red-900 dark:bg-red-950/40"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Couldn&apos;t load your graph
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {graphError}
          </p>
          <button
            type="button"
            onClick={() => void loadGraph()}
            className="mt-3 rounded-md border border-red-300 bg-background px-3 py-1.5 text-xs font-medium text-red-900 dark:border-red-800 dark:text-red-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loadingGraph && !graphError && !hasNodes ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <p className="max-w-sm text-base text-zinc-600 dark:text-zinc-400">
            You haven&apos;t added anyone yet. Click &apos;+ Add Person&apos; to
            get started!
          </p>
        </div>
      ) : null}

      <div
        ref={graphContainerRef}
        className={`min-h-[200px] min-h-0 w-full flex-1 ${graphReady ? 'block' : 'hidden'}`}
        aria-hidden={!graphReady}
      >
        {graphReady && graphSize.width > 0 && graphSize.height > 0 ? (
          <ForceGraph2D
            width={graphSize.width}
            height={graphSize.height}
            {...fgProps}
          />
        ) : null}
      </div>

      {linkTip ? (
        <div
          className="pointer-events-none fixed z-50 max-w-[min(18rem,calc(100vw-1.5rem))] -translate-y-full rounded-lg border border-zinc-200 bg-background px-3 py-2 shadow-lg dark:border-zinc-700"
          style={{
            left: Math.min(linkTip.x + 8, typeof window !== 'undefined' ? window.innerWidth - 200 : linkTip.x),
            top: linkTip.y - 8,
          }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Relationship
          </p>
          <p className="text-sm font-medium text-foreground">{linkTip.label}</p>
        </div>
      ) : null}

      {selectedNode ? (
        <aside
          className={`fixed right-0 top-14 z-20 flex h-[calc(100dvh-3.5rem)] w-full max-w-sm flex-col border-l border-zinc-200 bg-background shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 ${
            panelSlideOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <h2 className="pr-2 text-lg font-semibold leading-snug tracking-tight text-foreground">
              {String(selectedNode.name)}
            </h2>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => closeNodePanelAnimated()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                Attributes
              </span>
              <button
                type="button"
                onClick={addNodePanelAttrRow}
                className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
              >
                + Add Attribute
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {nodePanelRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    aria-label={`Attribute key ${i + 1}`}
                    placeholder="Key"
                    value={row.key}
                    onChange={(e) =>
                      updateNodePanelRow(i, 'key', e.target.value)
                    }
                    className="w-[36%] rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                  />
                  <input
                    aria-label={`Attribute value ${i + 1}`}
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) =>
                      updateNodePanelRow(i, 'value', e.target.value)
                    }
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeNodePanelRow(i)}
                    className="shrink-0 rounded-md px-2 text-sm text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    aria-label={`Remove attribute row ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {panelSaveError ? (
              <div
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              >
                {panelSaveError}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <button
              type="button"
              disabled={panelSaving || panelDeleting}
              onClick={() => void handleSaveNodeAttributes()}
              className="w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-background transition-opacity disabled:opacity-50"
            >
              {panelSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={panelDeleting || panelSaving}
              onClick={() => void handleDeleteNode()}
              className="w-full rounded-md border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950/80"
            >
              {panelDeleting ? 'Deleting…' : 'Delete Person'}
            </button>
          </div>
        </aside>
      ) : null}

      <div className="fixed bottom-4 left-4 right-4 z-30 flex flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setPersonModalOpen(true)
            setSubmitError(null)
          }}
          className="w-full rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg transition-opacity hover:opacity-90 sm:w-auto sm:px-5 sm:text-base"
        >
          + Add Person
        </button>
        <button
          type="button"
          onClick={() => {
            setConnectionModalOpen(true)
            setConnectionSubmitError(null)
            setPersonAId('')
            setPersonBId('')
            setRelationshipLabel('')
          }}
          className="w-full rounded-full border border-zinc-300 bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-opacity hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900 sm:w-auto sm:px-5 sm:text-base"
        >
          + Add Connection
        </button>
      </div>

      {personModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-person-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-background p-6 shadow-xl dark:border-zinc-700"
          >
            <h2
              id="add-person-title"
              className="text-lg font-semibold text-foreground"
            >
              Add person
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Create a node on your graph. Add optional attributes as key/value
              pairs.
            </p>

            <form
              onSubmit={(e) => void handleAddPerson(e)}
              className="mt-6 flex flex-col gap-4"
            >
              {submitError ? (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                >
                  {submitError}
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="person-name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="person-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                  placeholder="Alex Rivera"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Attributes</span>
                  <button
                    type="button"
                    onClick={addAttrRow}
                    className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    + Add row
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {attrRows.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        aria-label={`Attribute key ${i + 1}`}
                        placeholder="Key"
                        value={row.key}
                        onChange={(e) =>
                          updateAttrRow(i, 'key', e.target.value)
                        }
                        className="w-2/5 rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                      />
                      <input
                        aria-label={`Attribute value ${i + 1}`}
                        placeholder="Value"
                        value={row.value}
                        onChange={(e) =>
                          updateAttrRow(i, 'value', e.target.value)
                        }
                        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                      />
                      {attrRows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeAttrRow(i)}
                          className="shrink-0 px-2 text-xs text-zinc-500 hover:text-red-600"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-md bg-foreground py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Add to graph'}
                </button>
                <button
                  type="button"
                  onClick={() => setPersonModalOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {connectionModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-connection-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-background p-6 shadow-xl dark:border-zinc-700"
          >
            <h2
              id="add-connection-title"
              className="text-lg font-semibold text-foreground"
            >
              Add connection
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Link two people. The arrow points from Person A toward Person B.
            </p>

            <form
              onSubmit={(e) => void handleAddConnection(e)}
              className="mt-6 flex flex-col gap-4"
            >
              {connectionSubmitError ? (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                >
                  {connectionSubmitError}
                </div>
              ) : null}

              {graphData.nodes.length < 2 ? (
                <p className="text-sm text-zinc-500">
                  Add at least two people before creating a connection.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="person-a"
                      className="text-sm font-medium text-foreground"
                    >
                      Person A
                    </label>
                    <select
                      id="person-a"
                      required
                      value={personAId}
                      onChange={(e) => setPersonAId(e.target.value)}
                      className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                    >
                      <option value="">Choose…</option>
                      {graphData.nodes.map((n) => (
                        <option key={String(n.id)} value={String(n.id)}>
                          {String(n.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="person-b"
                      className="text-sm font-medium text-foreground"
                    >
                      Person B
                    </label>
                    <select
                      id="person-b"
                      required
                      value={personBId}
                      onChange={(e) => setPersonBId(e.target.value)}
                      className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                    >
                      <option value="">Choose…</option>
                      {graphData.nodes.map((n) => (
                        <option key={String(n.id)} value={String(n.id)}>
                          {String(n.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="relationship-label"
                      className="text-sm font-medium text-foreground"
                    >
                      Relationship
                    </label>
                    <input
                      id="relationship-label"
                      value={relationshipLabel}
                      onChange={(e) => setRelationshipLabel(e.target.value)}
                      className="rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 dark:border-zinc-600"
                      placeholder="e.g. friend, colleague, family"
                    />
                  </div>
                </>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={
                    connectionSubmitting || graphData.nodes.length < 2
                  }
                  className="flex-1 rounded-md bg-foreground py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {connectionSubmitting ? 'Saving…' : 'Add connection'}
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionModalOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

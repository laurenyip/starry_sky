'use client'

import { createClient } from '@supabase/supabase-js'
import {
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState } from 'react'

type DirectoryRow = {
  id: string
  name: string
  slug: string
  published: boolean
  publish_password: string | null
  background_color: string | null
  overlay_image_url: string | null
  overlay_position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null
  overlay_opacity: number | null
}

type DirectoryNodeRow = {
  id: string
  name: string
  avatar_url: string | null
  photo_url: string | null
  birthday: string | null
  location: string | null
  cohort: string | null
  interests: string | null
  discord: string | null
  email: string | null
  custom_attributes: Record<string, unknown> | null
  canvas_x: number | null
  canvas_y: number | null
}

type DirectoryEdgeRow = {
  id: string
  source_id: string
  target_id: string
}

function PublicDirectoryInner({ slug }: { slug: string }) {
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )
  const [loading, setLoading] = useState(true)
  const [directory, setDirectory] = useState<DirectoryRow | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [nodesRows, setNodesRows] = useState<DirectoryNodeRow[]>([])
  const [edgesRows, setEdgesRows] = useState<DirectoryEdgeRow[]>([])
  const [selectedNode, setSelectedNode] = useState<DirectoryNodeRow | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const { data: dir } = await supabase
        .from('directories')
        .select(
          'id,name,slug,published,publish_password,background_color,overlay_image_url,overlay_position,overlay_opacity'
        )
        .eq('slug', slug)
        .maybeSingle()

      if (!active) return
      if (!dir || !dir.published) {
        setDirectory(null)
        setLoading(false)
        return
      }
      const row = dir as DirectoryRow
      setDirectory(row)

      const token = sessionStorage.getItem(`directory:${slug}:ok`)
      if (token === '1') setAuthorized(true)

      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('directory_nodes').select('*').eq('directory_id', row.id),
        supabase.from('directory_edges').select('id,source_id,target_id').eq('directory_id', row.id),
      ])
      if (!active) return
      setNodesRows((nodesRes.data as DirectoryNodeRow[]) ?? [])
      setEdgesRows((edgesRes.data as DirectoryEdgeRow[]) ?? [])
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [slug, supabase])

  const nodes = useMemo<Node[]>(
    () =>
      nodesRows.map((n) => ({
        id: n.id,
        position: { x: n.canvas_x ?? 0, y: n.canvas_y ?? 0 },
        draggable: false,
        selectable: false,
        data: {
          label: n.name,
          avatarUrl: n.avatar_url ?? n.photo_url,
        },
        style: {
          width: 56,
          height: 56,
          borderRadius: '9999px',
          border: '1px solid rgba(161,161,170,0.6)',
          background: '#111827',
          color: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontSize: 10,
          fontWeight: 600,
        },
      })),
    [nodesRows]
  )

  const edges = useMemo<Edge[]>(
    () =>
      edgesRows.map((e) => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        selectable: false,
        style: { stroke: '#9ca3af', strokeWidth: 1, opacity: 0.55 },
      })),
    [edgesRows]
  )

  const [rfNodes, , onNodesChange] = useNodesState(nodes)
  const [rfEdges, , onEdgesChange] = useEdgesState(edges)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-zinc-500">
        Loading...
      </div>
    )
  }

  if (!directory) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-base text-foreground">
        This page is not available
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4">
        <div className="w-full rounded-xl border border-zinc-200 bg-background p-5 dark:border-zinc-800">
          <h1 className="text-lg font-semibold text-foreground">{directory.name}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Enter password to view this page.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="mt-3 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={() => {
              if (passwordInput === (directory.publish_password ?? '')) {
                sessionStorage.setItem(`directory:${slug}:ok`, '1')
                setAuthorized(true)
              }
            }}
            className="mt-3 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-5rem)] min-h-[30rem]">
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_, node) => {
            setSelectedNode(nodesRows.find((n) => n.id === node.id) ?? null)
          }}
          fitView
          className="h-full"
          style={{ background: directory.background_color ?? '#0a0a0f' }}
        >
          <MiniMap />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>

      {directory.overlay_image_url ? (
        <img
          src={directory.overlay_image_url}
          alt=""
          className={`pointer-events-none absolute z-10 h-20 w-20 object-contain ${
            (directory.overlay_position ?? 'top-right') === 'top-left'
              ? 'left-5 top-5'
              : (directory.overlay_position ?? 'top-right') === 'top-right'
                ? 'right-5 top-5'
                : (directory.overlay_position ?? 'top-right') === 'bottom-left'
                  ? 'bottom-5 left-5'
                  : 'bottom-5 right-5'
          }`}
          style={{ opacity: directory.overlay_opacity ?? 0.15 }}
        />
      ) : null}

      {selectedNode ? (
        <aside className="absolute right-3 top-3 z-20 w-80 rounded-xl border border-zinc-200 bg-background/95 p-3 shadow-xl dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{selectedNode.name}</h2>
            <button type="button" onClick={() => setSelectedNode(null)} className="text-lg leading-none">×</button>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto text-sm">
            {selectedNode.photo_url || selectedNode.avatar_url ? (
              <img
                src={selectedNode.photo_url ?? selectedNode.avatar_url ?? ''}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : null}
            <p><span className="text-zinc-500">Cohort:</span> {selectedNode.cohort || '-'}</p>
            <p><span className="text-zinc-500">Location:</span> {selectedNode.location || '-'}</p>
            <p><span className="text-zinc-500">Discord:</span> {selectedNode.discord || '-'}</p>
            <p><span className="text-zinc-500">Email:</span> {selectedNode.email || '-'}</p>
            <p><span className="text-zinc-500">Birthday:</span> {selectedNode.birthday || '-'}</p>
            <p><span className="text-zinc-500">Interests:</span> {selectedNode.interests || '-'}</p>
            {Object.entries(selectedNode.custom_attributes ?? {}).map(([k, v]) => (
              <p key={k}><span className="text-zinc-500">{k}:</span> {String(v ?? '') || '-'}</p>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  )
}

export default function PublicDirectoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const [slug, setSlug] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    void params.then((p) => {
      if (mounted) setSlug(decodeURIComponent(p.slug))
    })
    return () => {
      mounted = false
    }
  }, [params])
  if (!slug) return null
  return <PublicDirectoryInner slug={slug} />
}


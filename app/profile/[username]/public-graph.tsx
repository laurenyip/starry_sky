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
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo } from 'react'

const nodeTypes = { constellation: ConstellationNode, person: PersonNode }
const edgeTypes = { labeled: LabeledEdge }

export type PublicGraphPayload = {
  locations: DbLocation[]
  people: DbPerson[]
  edges: DbEdge[]
  /** Community id → hex stroke color */
  communityColors?: Record<string, string>
}

export function PublicProfileGraph({ graphData }: { graphData: PublicGraphPayload }) {
  return (
    <ReactFlowProvider>
      <PublicGraphInner graphData={graphData} />
    </ReactFlowProvider>
  )
}

function PublicGraphInner({ graphData }: { graphData: PublicGraphPayload }) {
  const selfNodeId = useMemo(
    () => graphData.people.find((p) => p.is_self)?.id ?? null,
    [graphData.people]
  )

  const needsForceLayout = useMemo(
    () =>
      graphData.people.some((p) => {
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
    [graphData.people]
  )

  const communityColorMap = useMemo(() => {
    const m = new Map<string, string>()
    const rec = graphData.communityColors
    if (rec) {
      for (const [id, hex] of Object.entries(rec)) m.set(id, hex)
    }
    return m
  }, [graphData.communityColors])

  const { nodes: initialNodes, edges: initialEdges } = buildFlowElements(
    graphData.locations,
    graphData.people,
    graphData.edges,
    {
      runForceLayout: needsForceLayout,
      shiftConnect: false,
      communityColors: communityColorMap,
    }
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    const { nodes: n, edges: e } = buildFlowElements(
      graphData.locations,
      graphData.people,
      graphData.edges,
      {
        runForceLayout: needsForceLayout,
        shiftConnect: false,
        communityColors: communityColorMap,
        selfNodeId,
      }
    )
    setNodes(n)
    setEdges(e)
  }, [
    graphData.locations,
    graphData.people,
    graphData.edges,
    communityColorMap,
    needsForceLayout,
    selfNodeId,
    setNodes,
    setEdges,
  ])

  return (
    <div className="h-[min(70vh,720px)] min-h-[420px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        fitView
        minZoom={0.3}
        maxZoom={1.3}
        className="bg-zinc-50/50 dark:bg-zinc-950/40"
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
  )
}

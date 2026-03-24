'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ForceGraphProps } from 'react-force-graph-2d'
import type { LinkObject, NodeObject } from 'react-force-graph-2d'

export type PublicGraphNode = NodeObject<{
  id: string
  name: string
  [key: string]: unknown
}>

export type PublicGraphLink = LinkObject<
  PublicGraphNode,
  { id: string; label: string | null }
>

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
}) as React.ComponentType<ForceGraphProps<PublicGraphNode, PublicGraphLink>>

function labelColor() {
  if (typeof window === 'undefined') return '#27272a'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? '#d4d4d8'
    : '#27272a'
}

export function PublicProfileGraph({
  graphData,
}: {
  graphData: {
    nodes: PublicGraphNode[]
    links: PublicGraphLink[]
  }
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({
        width: Math.max(1, Math.floor(cr.width)),
        height: Math.max(1, Math.floor(cr.height)),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fgProps = useMemo<ForceGraphProps<PublicGraphNode, PublicGraphLink>>(
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
        const s = link.source as PublicGraphNode
        const t = link.target as PublicGraphNode
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
      enableNodeDrag: false,
      cooldownTicks: 100,
      linkDirectionalArrowLength: 10,
      linkDirectionalArrowRelPos: 1,
      linkDirectionalArrowColor: () =>
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? '#a1a1aa'
          : '#52525b',
    }),
    [graphData]
  )

  return (
    <div
      ref={wrapRef}
      className="h-full min-h-[min(50vh,28rem)] w-full min-w-0 flex-1"
    >
      {size.width > 0 && size.height > 0 ? (
        <ForceGraph2D width={size.width} height={size.height} {...fgProps} />
      ) : null}
    </div>
  )
}

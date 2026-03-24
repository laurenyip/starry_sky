'use client'

import { communityStyle } from '@/lib/community-colors'
import { useStore } from '@xyflow/react'
import { useMemo } from 'react'

type Const = { id: string; name: string; color_index: number }

/** Soft glowing regions behind nodes for social constellations (flow coordinates). */
export function CommunityRegionsLayer({
  constellations,
  nodeIdsByConstellationId,
}: {
  constellations: Const[]
  nodeIdsByConstellationId: Record<string, string[]>
}) {
  const nodeLookup = useStore((s) => s.nodeLookup)

  const rects = useMemo(() => {
    const out: {
      id: string
      name: string
      x: number
      y: number
      w: number
      h: number
      style: ReturnType<typeof communityStyle>
    }[] = []

    for (const c of constellations) {
      const ids = nodeIdsByConstellationId[c.id] ?? []
      if (ids.length === 0) continue
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      let any = false
      for (const id of ids) {
        const internal = nodeLookup.get(id)
        const pos = internal?.internals?.positionAbsolute
        if (!pos) continue
        any = true
        const w = internal?.measured?.width ?? 52
        const h = internal?.measured?.height ?? 52
        minX = Math.min(minX, pos.x)
        minY = Math.min(minY, pos.y)
        maxX = Math.max(maxX, pos.x + w)
        maxY = Math.max(maxY, pos.y + h)
      }
      if (!any || !Number.isFinite(minX)) continue
      const pad = 28
      out.push({
        id: c.id,
        name: c.name,
        x: minX - pad,
        y: minY - pad,
        w: maxX - minX + pad * 2,
        h: maxY - minY + pad * 2,
        style: communityStyle(c.color_index),
      })
    }
    return out
  }, [constellations, nodeIdsByConstellationId, nodeLookup])

  if (rects.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: '100%', height: '100%', zIndex: 0, overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        {rects.map((r) => (
          <filter
            key={`glow-${r.id}`}
            id={`glow-${r.id}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="14" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
      {rects.map((r) => (
        <g key={r.id}>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={36}
            ry={36}
            fill={r.style.fill}
            stroke={r.style.stroke}
            strokeWidth={1.5}
            strokeOpacity={0.3}
            filter={`url(#glow-${r.id})`}
            style={{ mixBlendMode: 'multiply' }}
          />
          <text
            x={r.x + 18}
            y={r.y + 22}
            className="fill-zinc-500 text-[11px] font-semibold uppercase tracking-wider"
            style={{ pointerEvents: 'none' }}
          >
            {r.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

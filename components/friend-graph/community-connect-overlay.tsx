'use client'

import { useStore, ViewportPortal } from '@xyflow/react'
import { useMemo } from 'react'

export type CommunityOverlayPair = { source: string; target: string }

type Props = {
  /** All unordered member pairs (client-only overlay; not in DB). */
  pairs: CommunityOverlayPair[]
  stroke: string
}

/**
 * Dashed constellation chain between selected community members (ViewportPortal coords).
 */
export function CommunityConnectOverlay({ pairs, stroke }: Props) {
  const lineSignature = useStore((s) => {
    const ids = new Set<string>()
    for (const p of pairs) {
      ids.add(p.source)
      ids.add(p.target)
    }
    const parts: string[] = []
    for (const id of [...ids].sort()) {
      const n = s.nodeLookup.get(id)
      if (!n || n.type !== 'person') continue
      const { x, y } = n.internals.positionAbsolute
      const w = n.measured?.width ?? 52
      const h = n.measured?.height ?? 52
      parts.push(`${id}:${x + w / 2}:${y + h / 2}`)
    }
    return parts.join('|')
  })

  const layout = useMemo(() => {
    const posById = new Map<string, { x: number; y: number }>()
    for (const part of lineSignature.split('|')) {
      if (!part) continue
      const [id, xs, ys] = part.split(':')
      const x = Number(xs)
      const y = Number(ys)
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      posById.set(id, { x, y })
    }
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (const p of pairs) {
      const a = posById.get(p.source)
      const b = posById.get(p.target)
      if (!a || !b) continue
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    if (lines.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const ln of lines) {
      minX = Math.min(minX, ln.x1, ln.x2)
      minY = Math.min(minY, ln.y1, ln.y2)
      maxX = Math.max(maxX, ln.x1, ln.x2)
      maxY = Math.max(maxY, ln.y1, ln.y2)
    }
    const pad = 24
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad
    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
      lines: lines.map((ln) => ({
        x1: ln.x1 - minX,
        y1: ln.y1 - minY,
        x2: ln.x2 - minX,
        y2: ln.y2 - minY,
      })),
    }
  }, [lineSignature, pairs])

  if (!layout || layout.lines.length === 0) return null

  return (
    <ViewportPortal>
      <svg
        className="pointer-events-none"
        style={{
          position: 'absolute',
          left: layout.minX,
          top: layout.minY,
          width: layout.width,
          height: layout.height,
          overflow: 'visible',
          zIndex: 4,
        }}
        width={layout.width}
        height={layout.height}
      >
        {layout.lines.map((ln, i) => (
          <line
            key={i}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke={stroke}
            strokeWidth={1}
            strokeOpacity={0.6}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </ViewportPortal>
  )
}

'use client'

import { useMemo } from 'react'
import { useStore, ViewportPortal } from '@xyflow/react'

type Pair = { source: string; target: string }

export function ConstellationOverlay(props: {
  memberIds: string[]
  pairs: Pair[]
}) {
  const { memberIds, pairs } = props

  const lineSignature = useStore((s) => {
    const ids = new Set<string>(memberIds)
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

    const pts = [...posById.values()]
    if (pts.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of pts) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
    const pad = 46
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

  if (!layout) return null

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
          zIndex: 3,
        }}
        width={layout.width}
        height={layout.height}
      >
        <defs>
          <filter id="constellationGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x={6}
          y={6}
          width={Math.max(0, layout.width - 12)}
          height={Math.max(0, layout.height - 12)}
          rx={22}
          ry={22}
          fill="rgba(0,0,0,0)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1.2}
          filter="url(#constellationGlow)"
        />

        {layout.lines.map((ln, i) => (
          <line
            key={i}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={0.8}
            strokeLinecap="round"
            filter="url(#constellationGlow)"
          />
        ))}
      </svg>
    </ViewportPortal>
  )
}


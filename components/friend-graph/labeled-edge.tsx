'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  useStore,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'

export type LabeledEdgeData = {
  displayName: string
  tooltip: string
  baseStroke: string
  communityKey: string
}

export function LabeledEdge({
  id,
  style,
  selected,
  data,
  source,
  target,
}: EdgeProps<Edge<LabeledEdgeData>>) {
  const sig = useStore((s) => {
    const a = s.nodeLookup.get(source)
    const b = s.nodeLookup.get(target)
    if (!a || !b) return ''
    const ax = a.internals.positionAbsolute.x
    const ay = a.internals.positionAbsolute.y
    const aw = a.measured?.width ?? 52
    const ah = a.measured?.height ?? 52
    const bx = b.internals.positionAbsolute.x
    const by = b.internals.positionAbsolute.y
    const bw = b.measured?.width ?? 52
    const bh = b.measured?.height ?? 52
    return `${source}:${ax}:${ay}:${aw}:${ah}|${target}:${bx}:${by}:${bw}:${bh}`
  })

  const { path, labelX, labelY } = (() => {
    const parts = sig.split('|')
    if (parts.length !== 2) {
      return { path: 'M 0 0 L 0 0', labelX: 0, labelY: 0 }
    }
    const [a] = parts
    const [, axS, ayS, awS, ahS] = a.split(':')
    const [b] = parts.slice(1)
    const [, bxS, byS, bwS, bhS] = b.split(':')
    const ax = Number(axS)
    const ay = Number(ayS)
    const aw = Number(awS)
    const ah = Number(ahS)
    const bx = Number(bxS)
    const by = Number(byS)
    const bw = Number(bwS)
    const bh = Number(bhS)
    if (
      !Number.isFinite(ax) ||
      !Number.isFinite(ay) ||
      !Number.isFinite(aw) ||
      !Number.isFinite(ah) ||
      !Number.isFinite(bx) ||
      !Number.isFinite(by) ||
      !Number.isFinite(bw) ||
      !Number.isFinite(bh)
    ) {
      return { path: 'M 0 0 L 0 0', labelX: 0, labelY: 0 }
    }

    const acx = ax + aw / 2
    const acy = ay + ah / 2
    const bcx = bx + bw / 2
    const bcy = by + bh / 2

    const dx = bcx - acx
    const dy = bcy - acy
    const dist = Math.hypot(dx, dy)
    if (!Number.isFinite(dist) || dist < 1e-6) {
      return { path: `M ${acx} ${acy} L ${acx} ${acy}`, labelX: acx, labelY: acy }
    }

    // Circle radius based on rendered size (PersonNode is a circle).
    const ra = Math.min(aw, ah) / 2
    const rb = Math.min(bw, bh) / 2
    const ux = dx / dist
    const uy = dy / dist

    const x1 = acx + ux * ra
    const y1 = acy + uy * ra
    const x2 = bcx - ux * rb
    const y2 = bcy - uy * rb

    return {
      path: `M ${x1} ${y1} L ${x2} ${y2}`,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2,
    }
  })()

  const fallback = data?.baseStroke ?? '#AAAAAA'
  const stroke =
    typeof style?.stroke === 'string' && style.stroke.length > 0
      ? style.stroke
      : fallback

  const strokeWidth =
    typeof style?.strokeWidth === 'number' ? style.strokeWidth : 2

  const opacity =
    typeof style?.opacity === 'number' ? style.opacity : 1

  const transition =
    (style?.transition as string | undefined) ??
    'stroke 0.28s ease, stroke-width 0.28s ease, opacity 0.28s ease'

  const rel = (data?.displayName ?? '').trim() || '—'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={undefined}
        markerStart={undefined}
        style={{
          ...style,
          stroke,
          strokeWidth,
          opacity,
          transition,
          cursor: 'pointer',
        }}
        interactionWidth={28}
      />
      {selected ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none rounded-full border border-zinc-200/90 bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-md dark:border-zinc-600/90"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {rel}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

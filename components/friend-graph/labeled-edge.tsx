'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
  data,
}: EdgeProps<Edge<LabeledEdgeData>>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

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

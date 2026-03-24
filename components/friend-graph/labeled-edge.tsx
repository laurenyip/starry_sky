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
  relationshipLabel: string
  tooltip: string
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

  const stroke = selected ? '#7c3aed' : undefined
  const baseStroke =
    typeof style?.stroke === 'string' ? style.stroke : '#71717a'

  const rel = (data?.relationshipLabel ?? '').trim() || '—'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={undefined}
        markerStart={undefined}
        style={{
          ...style,
          stroke: stroke ?? baseStroke,
          strokeWidth: selected ? 3 : 2,
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

'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'

export type LabeledEdgeData = { label: string }

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
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

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: stroke ?? baseStroke,
          strokeWidth: selected ? 3 : 2,
        }}
        interactionWidth={28}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-none rounded-full border border-zinc-200/90 bg-background/95 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm dark:border-zinc-600/90"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {data?.label ?? '—'}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

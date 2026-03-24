'use client'

import {
  CONSTELLATION_HEIGHT,
  CONSTELLATION_WIDTH,
} from '@/lib/graph-model'
import type { Node, NodeProps } from '@xyflow/react'

export type ConstellationNodeData = { label: string; locationId: string | null }

export function ConstellationNode({
  data,
}: NodeProps<Node<ConstellationNodeData>>) {
  return (
    <div
      className="pointer-events-none relative rounded-3xl border border-zinc-300/40 bg-gradient-to-br from-violet-500/[0.06] to-sky-500/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:border-zinc-600/50 dark:from-violet-400/[0.07] dark:to-sky-400/[0.05]"
      style={{
        width: CONSTELLATION_WIDTH,
        height: CONSTELLATION_HEIGHT,
      }}
    >
      <div className="absolute left-4 top-3 max-w-[calc(100%-2rem)] truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {data.label}
      </div>
      <div
        aria-hidden
        className="absolute inset-8 rounded-2xl border border-dashed border-zinc-400/25 dark:border-zinc-500/25"
      />
    </div>
  )
}

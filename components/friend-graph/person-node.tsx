'use client'

import { relationshipTitle } from '@/lib/graph-model'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import Image from 'next/image'

export type PersonNodeData = {
  name: string
  relationship: string
  avatarUrl?: string | null
  shiftConnect?: boolean
  justAdded?: boolean
  /** Hex colour for the ring from edge.relation_type (owner ↔ this person). */
  relationBorderHex?: string
  /** Community legend focus: bright glow ring in this colour for member nodes. */
  communityMemberGlowHex?: string | null
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export function PersonNode({
  data,
  selected,
}: NodeProps<Node<PersonNodeData>>) {
  const connectable = data.shiftConnect === true
  const avatar = data.avatarUrl?.trim()
  const ringHex = data.relationBorderHex?.trim()
  const glowHex = data.communityMemberGlowHex?.trim()
  const defaultRing = !selected && !ringHex && !glowHex

  const glowStyle =
    !selected && glowHex
      ? {
          boxShadow: `0 0 16px 5px ${glowHex}99, 0 0 0 2px ${glowHex}`,
          borderColor: glowHex,
        }
      : undefined

  return (
    <div
      className={[
        'relative flex h-[52px] w-[52px] select-none items-center justify-center overflow-hidden rounded-full border-2 bg-background text-xs font-semibold text-foreground shadow-md transition-[box-shadow,transform,border-color,opacity]',
        selected
          ? 'border-violet-500 ring-2 ring-violet-400/40'
          : defaultRing
            ? 'border-zinc-300 dark:border-zinc-600'
            : '',
        data.justAdded ? 'animate-[node-in_0.65s_cubic-bezier(0.34,1.56,0.64,1)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(!selected && ringHex && !glowHex ? { borderColor: ringHex } : {}),
        ...glowStyle,
      }}
      title={data.name}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        className="!border-none !bg-transparent"
        style={{ width: 10, height: 10, opacity: connectable ? 0.35 : 0 }}
        isConnectable={connectable}
      />
      {avatar ? (
        <Image
          src={avatar}
          alt=""
          width={48}
          height={48}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span className="pointer-events-none leading-none tracking-tight">
          {initials(data.name)}
        </span>
      )}
      <span className="pointer-events-none absolute -bottom-5 left-1/2 max-w-[7rem] -translate-x-1/2 truncate text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
        {relationshipTitle(data.relationship)}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        id="s"
        className="!border-none !bg-transparent"
        style={{ width: 10, height: 10, opacity: connectable ? 0.35 : 0 }}
        isConnectable={connectable}
      />
    </div>
  )
}

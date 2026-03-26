'use client'

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
  /** Membership indicators (one or more community colours). */
  communityColorDots?: string[]
  isSelf?: boolean
}

function initials(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

function splitNameLabel(name: string): string[] {
  const t = name.trim()
  if (t.length <= 20) return [t]
  let splitAt = t.lastIndexOf(' ', 20)
  if (splitAt < 0) splitAt = 20
  const first = t.slice(0, splitAt).trim()
  const second = t.slice(splitAt).trim()
  if (!second) return [first]
  return [first, second]
}

export function PersonNode({
  data,
  selected,
}: NodeProps<Node<PersonNodeData>>) {
  const connectable = data.shiftConnect === true
  const avatar = data.avatarUrl?.trim()
  const isSelf = data.isSelf === true
  const glowHex = data.communityMemberGlowHex?.trim()
  const labelLines = isSelf ? ['You'] : splitNameLabel(data.name)

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
        'relative flex h-[52px] w-[52px] select-none items-center justify-center rounded-full text-xs font-semibold text-foreground shadow-md transition-[box-shadow,transform,border-color,opacity]',
        isSelf ? 'h-[84px] w-[84px]' : '',
        selected
          ? 'ring-2 ring-violet-400/40'
          : '',
        data.justAdded ? 'animate-[node-in_0.65s_cubic-bezier(0.34,1.56,0.64,1)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
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
      {isSelf ? (
        <div
          className="h-full w-full rounded-full p-[3px]"
          style={{ backgroundColor: selected ? '#8B5CF6' : '#111827' }}
        >
          <div className="h-full w-full rounded-full bg-white p-[2px]">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
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
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
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
        </div>
      )}
      {data.communityColorDots?.length ? (
        <div className="pointer-events-none absolute inset-0">
          {data.communityColorDots.map((hex, i) => {
            const total = data.communityColorDots!.length
            const angleDeg =
              total === 1 ? 270 : 200 + (i * (340 - 200)) / (total - 1)
            const rad = (angleDeg * Math.PI) / 180
            const orbit = 18
            const size = 5
            return (
              <span
                key={`${hex}-${i}`}
                className="absolute rounded-full border border-white dark:border-zinc-900"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: hex,
                  left: `calc(50% + ${Math.cos(rad) * orbit}px - ${size / 2}px)`,
                  top: `calc(50% + ${Math.sin(rad) * orbit}px - ${size / 2}px)`,
                }}
              />
            )
          })}
        </div>
      ) : null}
      <div
        className={`pointer-events-none absolute left-1/2 w-[7.5rem] -translate-x-1/2 text-center leading-[1.1] whitespace-normal break-words dark:text-zinc-400 ${
          isSelf
            ? '-bottom-9 text-[12px] font-bold text-zinc-700'
            : '-bottom-8 text-[10px] font-medium text-zinc-600'
        }`}
      >
        {labelLines[0]}
        {labelLines[1] ? <><br />{labelLines[1]}</> : null}
      </div>
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

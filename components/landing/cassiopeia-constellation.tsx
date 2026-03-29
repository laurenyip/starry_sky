'use client'

type CassiopeiaConfig = {
  viewBox: string
  nodes: readonly {
    id: string
    x: number
    y: number
    label: string
    color: string
    delay: string
    you?: boolean
  }[]
  lines: readonly (readonly [number, number, number, number])[]
}

const DESKTOP: CassiopeiaConfig = {
  viewBox: '0 0 400 120',
  nodes: [
    { id: 'A', x: 30, y: 20, label: 'Maya', color: '#A78BFA', delay: '0s' },
    { id: 'B', x: 120, y: 90, label: 'Jordan', color: '#FB7185', delay: '0.4s' },
    { id: 'C', x: 200, y: 30, label: 'You', color: '#ffffff', delay: '0.8s', you: true },
    { id: 'D', x: 280, y: 90, label: 'Priya', color: '#34D399', delay: '1.2s' },
    { id: 'E', x: 370, y: 20, label: 'Sam', color: '#A78BFA', delay: '1.6s' },
  ],
  lines: [
    [30, 20, 120, 90],
    [120, 90, 200, 30],
    [200, 30, 280, 90],
    [280, 90, 370, 20],
  ],
} as const

const MOBILE: CassiopeiaConfig = {
  viewBox: '0 0 120 400',
  nodes: [
    { id: 'A', x: 60, y: 30, label: 'Maya', color: '#A78BFA', delay: '0s' },
    { id: 'B', x: 10, y: 100, label: 'Jordan', color: '#FB7185', delay: '0.4s' },
    { id: 'C', x: 100, y: 170, label: 'You', color: '#ffffff', delay: '0.8s', you: true },
    { id: 'D', x: 10, y: 240, label: 'Priya', color: '#34D399', delay: '1.2s' },
    { id: 'E', x: 100, y: 310, label: 'Sam', color: '#A78BFA', delay: '1.6s' },
  ],
  lines: [
    [60, 30, 10, 100],
    [10, 100, 100, 170],
    [100, 170, 10, 240],
    [10, 240, 100, 310],
  ],
}

function ConstellationSvg({
  config,
  className,
}: {
  config: CassiopeiaConfig
  className?: string
}) {
  return (
    <svg
      className={`text-gray-400 dark:text-gray-500 ${className ?? ''}`}
      viewBox={config.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {config.lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={`ln-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(167,139,250,0.3)"
          strokeWidth={1}
          strokeDasharray="4 4"
          className="animate-dash-flow"
        />
      ))}
      {config.nodes.map((n) => (
        <g key={n.id}>
          <circle
            cx={n.x}
            cy={n.y}
            r={n.you ? 10 : 8}
            fill={n.color}
            className="animate-node-pulse"
            style={{
              animationDelay: n.delay,
              filter: n.you
                ? 'drop-shadow(0 0 10px rgba(255,255,255,0.55))'
                : `drop-shadow(0 0 8px ${n.color})`,
            }}
            stroke={n.you ? 'rgba(124,58,237,0.55)' : 'none'}
            strokeWidth={n.you ? 2 : 0}
          />
          <text
            x={n.x}
            y={n.y + (n.you ? 22 : 20)}
            textAnchor="middle"
            fill="currentColor"
            className="text-[10px]"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function CassiopeiaConstellation() {
  return (
    <div className="mt-10 flex w-full justify-center px-2">
      <div className="hidden w-full max-w-[400px] md:block">
        <ConstellationSvg config={DESKTOP} className="h-auto w-full" />
      </div>
      <div className="flex max-h-[min(400px,55vh)] w-[120px] justify-center md:hidden">
        <ConstellationSvg config={MOBILE} className="h-full w-full" />
      </div>
    </div>
  )
}

'use client'

const TW = [
  'landing-node-twinkle-a',
  'landing-node-twinkle-b',
  'landing-node-twinkle-c',
  'landing-node-twinkle-d',
  'landing-node-twinkle-e',
] as const

type CassiopeiaConfig = {
  viewBox: string
  nodes: readonly {
    id: string
    x: number
    y: number
    label: string
    /** Main disc fill (light mode) */
    fill: string
    /** Main disc fill (dark mode) */
    darkFill: string
    you?: boolean
  }[]
  lines: readonly (readonly [number, number, number, number])[]
}

const DESKTOP: CassiopeiaConfig = {
  viewBox: '0 0 400 120',
  nodes: [
    { id: 'A', x: 30, y: 20, label: 'Maya', fill: '#a78bfa', darkFill: '#c4b5fd' },
    { id: 'B', x: 120, y: 90, label: 'Jordan', fill: '#f472b6', darkFill: '#fbcfe8' },
    { id: 'C', x: 200, y: 30, label: 'You', fill: '#7c3aed', darkFill: '#ddd6fe', you: true },
    { id: 'D', x: 280, y: 90, label: 'Priya', fill: '#34d399', darkFill: '#a7f3d0' },
    { id: 'E', x: 370, y: 20, label: 'Sam', fill: '#8b5cf6', darkFill: '#ddd6fe' },
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
    { id: 'A', x: 60, y: 30, label: 'Maya', fill: '#a78bfa', darkFill: '#c4b5fd' },
    { id: 'B', x: 10, y: 100, label: 'Jordan', fill: '#f472b6', darkFill: '#fbcfe8' },
    { id: 'C', x: 100, y: 170, label: 'You', fill: '#7c3aed', darkFill: '#ddd6fe', you: true },
    { id: 'D', x: 10, y: 240, label: 'Priya', fill: '#34d399', darkFill: '#a7f3d0' },
    { id: 'E', x: 100, y: 310, label: 'Sam', fill: '#8b5cf6', darkFill: '#ddd6fe' },
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
  idSuffix,
}: {
  config: CassiopeiaConfig
  className?: string
  idSuffix: string
}) {
  const glowId = `cassiopeia-twinkle-glow${idSuffix}`
  const glowDarkId = `cassiopeia-twinkle-glow-dark${idSuffix}`

  return (
    <svg className={className} viewBox={config.viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={glowDarkId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {config.lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={`ln-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          strokeDasharray="4 4"
          className="feature-mini-constellation-line constellation-line-breathe"
        />
      ))}

      {config.nodes.map((n, i) => {
        const r = n.you ? 6.5 : 5.5
        const tw = TW[i % 5]!
        const labelY = n.you ? 19 : 17

        return (
          <g key={n.id}>
            <g transform={`translate(${n.x} ${n.y})`}>
              <g className={tw}>
              {n.you ? (
                <>
                  <circle
                    r={r}
                    className="fill-violet-600 dark:hidden"
                    stroke="rgba(124,58,237,0.55)"
                    strokeWidth={2}
                    filter={`url(#${glowId})`}
                  />
                  <circle
                    r={r}
                    className="hidden dark:block fill-white"
                    stroke="rgba(124,58,237,0.55)"
                    strokeWidth={2}
                    filter={`url(#${glowDarkId})`}
                  />
                  <circle r={r * 0.3} className="fill-white/35 dark:hidden" />
                  <circle r={r * 0.3} className="hidden fill-violet-600/25 dark:block" />
                </>
              ) : (
                <>
                  <circle r={r} fill={n.fill} className="dark:hidden" filter={`url(#${glowId})`} />
                  <circle r={r} fill={n.darkFill} className="hidden dark:block" filter={`url(#${glowDarkId})`} />
                  <circle r={r * 0.3} fill="rgba(255,255,255,0.35)" />
                </>
              )}
              </g>
            </g>
            <text
              x={n.x}
              y={n.y + labelY}
              textAnchor="middle"
              className="fill-gray-600 text-[10px] dark:fill-white/85"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function CassiopeiaConstellation() {
  return (
    <div className="mt-10 flex w-full min-w-0 justify-center px-2 sm:px-4">
      <div className="hidden w-full max-w-[400px] md:block">
        <ConstellationSvg config={DESKTOP} className="h-auto w-full" idSuffix="-desk" />
      </div>
      <div className="flex max-h-[min(400px,55vh)] w-[120px] justify-center md:hidden">
        <ConstellationSvg config={MOBILE} className="h-full w-full" idSuffix="-mob" />
      </div>
    </div>
  )
}

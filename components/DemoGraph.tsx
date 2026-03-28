'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ForceGraphMethods } from 'react-force-graph-2d'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[320px] w-full animate-pulse rounded-2xl bg-[#080B14] md:h-[480px]"
      aria-hidden
    />
  ),
})

const DEMO_NODES = [
  {
    id: 'you',
    name: 'You',
    group: 'self' as const,
    bio: "That's you!",
    tags: [] as string[],
  },
  {
    id: 'maya',
    name: 'Maya',
    group: 'friends' as const,
    location: 'Vancouver',
    tags: ['Close Friend'],
    birthday: 'March 15',
    met: 'Met at university, 2019',
    note: 'Loves hiking and terrible puns',
  },
  {
    id: 'jordan',
    name: 'Jordan',
    group: 'friends' as const,
    location: 'Vancouver',
    tags: ['Friend', 'Classmate'],
    birthday: 'July 4',
    met: 'Met through Maya, 2020',
    note: 'Makes the best playlists',
  },
  {
    id: 'priya',
    name: 'Priya',
    group: 'friends' as const,
    location: 'Toronto',
    tags: ['Close Friend'],
    birthday: 'Nov 2',
    met: 'Online friends since 2018',
    note: 'Always recommends great books',
  },
  {
    id: 'sam',
    name: 'Sam',
    group: 'work' as const,
    location: 'Vancouver',
    tags: ['Colleague', 'Mentor'],
    met: 'Started same job, 2022',
    note: 'Taught me everything about design',
  },
  {
    id: 'alex',
    name: 'Alex',
    group: 'work' as const,
    location: 'Remote',
    tags: ['Colleague'],
    met: 'Met at a hackathon, 2023',
    note: 'Obsessed with productivity systems',
  },
  {
    id: 'nadia',
    name: 'Nadia',
    group: 'family' as const,
    location: 'Vancouver',
    tags: ['Family'],
    birthday: 'Jan 20',
    note: 'Best advice giver',
  },
  {
    id: 'leo',
    name: 'Leo',
    group: 'family' as const,
    location: 'Vancouver',
    tags: ['Family'],
    birthday: 'Sep 8',
    note: 'Somehow always right',
  },
  {
    id: 'zara',
    name: 'Zara',
    group: 'friends' as const,
    location: 'London',
    tags: ['Friend'],
    met: 'Studied abroad together, 2021',
    note: 'Sends the best memes',
  },
  {
    id: 'finn',
    name: 'Finn',
    group: 'work' as const,
    location: 'Remote',
    tags: ['Colleague', 'Classmate'],
    note: 'Coffee enthusiast',
  },
] as const

const DEMO_EDGES = [
  { source: 'you', target: 'maya' },
  { source: 'you', target: 'jordan' },
  { source: 'you', target: 'priya' },
  { source: 'you', target: 'sam' },
  { source: 'you', target: 'alex' },
  { source: 'you', target: 'nadia' },
  { source: 'you', target: 'leo' },
  { source: 'you', target: 'zara' },
  { source: 'maya', target: 'jordan' },
  { source: 'maya', target: 'zara' },
  { source: 'sam', target: 'alex' },
  { source: 'sam', target: 'finn' },
  { source: 'nadia', target: 'leo' },
  { source: 'jordan', target: 'priya' },
  { source: 'alex', target: 'finn' },
] as const

const DEMO_COMMUNITIES = [
  { id: 'friends', name: 'Close Friends', color: '#A78BFA' },
  { id: 'work', name: 'Work', color: '#34D399' },
  { id: 'family', name: 'Family', color: '#FB7185' },
] as const

const GROUP_COLORS: Record<string, string> = {
  self: '#FFFFFF',
  friends: '#A78BFA',
  work: '#34D399',
  family: '#FB7185',
}

const TAG_COLORS: Record<string, string> = {
  'Close Friend': '#A78BFA',
  Friend: '#C4B5FD',
  Classmate: '#67E8F9',
  Colleague: '#34D399',
  Mentor: '#6EE7B7',
  Family: '#FB7185',
}

type DemoGroup = keyof typeof GROUP_COLORS

type GraphNode = {
  id: string
  name: string
  group: DemoGroup
  pulseIndex: number
  fx?: number
  fy?: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

function tagColor(tag: string): string {
  return TAG_COLORS[tag] ?? '#94A3B8'
}

function communityForGroup(group: DemoGroup) {
  if (group === 'self') return DEMO_COMMUNITIES[0]
  return DEMO_COMMUNITIES.find((c) => c.id === group) ?? DEMO_COMMUNITIES[0]
}

export function DemoGraph() {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined)
  const graphWrapRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const activeNodeIdRef = useRef<string>('maya')
  const simulationDoneRef = useRef(false)
  const starsRef = useRef<
    {
      x: number
      y: number
      r: number
      opacity: number
      twinkleOffset: number
    }[]
  >([])

  const [dims, setDims] = useState({ width: 600, height: 320 })
  const [activeNodeId, setActiveNodeId] = useState('maya')
  const [sectionVisible, setSectionVisible] = useState(false)

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = DEMO_NODES.map((n, i) => ({
      id: n.id,
      name: n.name,
      group: n.group as DemoGroup,
      pulseIndex: i,
      ...(n.id === 'you' ? { fx: 0, fy: 0 } : {}),
    }))
    return { nodes, links: DEMO_EDGES.map((e) => ({ ...e })) }
  }, [])

  const nodeById = useMemo(
    () => new Map(graphData.nodes.map((n) => [n.id, n])),
    [graphData.nodes]
  )

  const nonYouIds = useMemo(
    () => DEMO_NODES.filter((n) => n.id !== 'you').map((n) => n.id),
    []
  )

  useEffect(() => {
    activeNodeIdRef.current = activeNodeId
  }, [activeNodeId])

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      const ids = DEMO_NODES.filter((n) => n.id !== 'you').map((n) => n.id)
      const next = ids[i % ids.length]
      i += 1
      setActiveNodeId(next ?? 'maya')
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSectionVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (starsRef.current.length) return
    starsRef.current = Array.from({ length: 80 }, () => ({
      x: (Math.random() - 0.5) * 1000,
      y: (Math.random() - 0.5) * 1000,
      r: Math.random() * 0.8 + 0.2,
      opacity: Math.random() * 0.4 + 0.1,
      twinkleOffset: Math.random() * Math.PI * 2,
    }))
  }, [])

  useEffect(() => {
    const el = graphWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = Math.max(200, el.clientWidth)
      const h = el.clientHeight || 320
      setDims({ width: w, height: h })
    })
    ro.observe(el)
    setDims({
      width: Math.max(200, el.clientWidth),
      height: el.clientHeight || 320,
    })
    return () => ro.disconnect()
  }, [])

  const linkColor = useCallback(
    (link: { source?: unknown }) => {
      const src =
        typeof link.source === 'object' && link.source !== null
          ? (link.source as GraphNode)
          : nodeById.get(String(link.source))
      const g = (src?.group ?? 'friends') as DemoGroup
      const hex = GROUP_COLORS[g] ?? '#A78BFA'
      if (hex.length === 7) return `${hex}30`
      return hex
    },
    [nodeById]
  )

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode
      const color = GROUP_COLORS[n.group] ?? '#A78BFA'
      const radius = n.group === 'self' ? 14 : 9
      const pulse =
        Math.sin(Date.now() / 900 + n.pulseIndex * 1.4) * 0.4 + 0.7
      const x = n.x ?? 0
      const y = n.y ?? 0

      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.2)
      const baseHex = color.length === 7 ? color : '#A78BFA'
      glow.addColorStop(0, `${baseHex}33`)
      glow.addColorStop(1, `${baseHex}00`)

      ctx.beginPath()
      ctx.arc(x, y, radius * 2.2, 0, 2 * Math.PI)
      ctx.fillStyle = glow
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.shadowBlur = 12 * pulse
      ctx.shadowColor = color
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      const fontPx = (n.group === 'self' ? 5 : 4) / globalScale
      ctx.font =
        n.group === 'self'
          ? `bold ${fontPx}px Inter, system-ui, sans-serif`
          : `${fontPx}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle =
        n.group === 'self'
          ? 'rgba(15, 23, 42, 0.9)'
          : 'rgba(255, 255, 255, 0.85)'
      ctx.fillText(n.name, x, y + radius + 6 / globalScale)

      if (activeNodeIdRef.current === n.id) {
        ctx.beginPath()
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI)
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5 / globalScale
        ctx.stroke()
      }
    },
    []
  )

  const onRenderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const fg = fgRef.current
      const now = Date.now()
      if (fg) {
        for (const star of starsRef.current) {
          const currentOpacity =
            star.opacity + Math.sin(now / 1200 + star.twinkleOffset) * 0.15
          const clamped = Math.max(0.05, Math.min(0.95, currentOpacity))
          const p = fg.graph2ScreenCoords(star.x, star.y)
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
          ctx.beginPath()
          ctx.arc(p.x, p.y, star.r, 0, 2 * Math.PI)
          ctx.fillStyle = `rgba(255,255,255,${clamped})`
          ctx.fill()
        }
      }

      if (simulationDoneRef.current) {
        for (const node of graphData.nodes) {
          if (node.id === 'you') continue
          node.vx = (node.vx ?? 0) + (Math.random() - 0.5) * 0.15
          node.vy = (node.vy ?? 0) + (Math.random() - 0.5) * 0.15
          node.x = (node.x ?? 0) + (node.vx ?? 0) * 0.02
          node.y = (node.y ?? 0) + (node.vy ?? 0) * 0.02
          node.vx *= 0.92
          node.vy *= 0.92
        }
      }
    },
    [graphData.nodes]
  )

  const onEngineStop = useCallback(() => {
    simulationDoneRef.current = true
    const fg = fgRef.current
    if (fg) {
      fg.centerAt(0, 0, 0)
      fg.zoom(1.05, 0)
    }
  }, [])

  const activeProfile = useMemo(
    () => DEMO_NODES.find((n) => n.id === activeNodeId) ?? DEMO_NODES[1],
    [activeNodeId]
  )

  return (
    <div
      ref={sectionRef}
      className={`relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 transition-opacity duration-[800ms] ease-out ${
        sectionVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-4 md:grid-cols-5">
        <div
          ref={graphWrapRef}
          className="h-[320px] overflow-hidden rounded-2xl border border-white/[0.08] md:col-span-3 md:h-[480px]"
          style={{
            backgroundColor: '#080B14',
            boxShadow:
              '0 0 60px rgba(139,92,246,0.12), 0 0 120px rgba(52,211,153,0.06)',
          }}
        >
          <ForceGraph2D
            ref={fgRef}
            width={dims.width}
            height={dims.height}
            graphData={graphData}
            backgroundColor="#080B14"
            autoPauseRedraw={false}
            enablePointerInteraction={false}
            enableZoomInteraction={false}
            enablePanInteraction={false}
            enableNodeDrag={false}
            cooldownTicks={180}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.35}
            linkWidth={0.6}
            linkColor={linkColor}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={nodeCanvasObject}
            onRenderFramePre={onRenderFramePre}
            onEngineStop={onEngineStop}
            onNodeClick={() => {}}
          />
        </div>

        <DemoNodeCard
          key={activeProfile.id}
          node={activeProfile}
          nonYouIds={nonYouIds}
          activeNodeId={activeNodeId}
        />
      </div>
    </div>
  )
}

type ProfileNode = (typeof DEMO_NODES)[number]

function DemoNodeCard({
  node,
  nonYouIds,
  activeNodeId,
}: {
  node: ProfileNode
  activeNodeId: string
  nonYouIds: readonly string[]
}) {
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 400, easing: 'ease-out', fill: 'both' }
    )
  }, [node.id])

  const group = node.group as DemoGroup
  const gc = GROUP_COLORS[group] ?? '#A78BFA'
  const community = communityForGroup(group)
  const initial = node.name.slice(0, 1).toUpperCase()

  return (
    <div className="flex h-[320px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0D1117] p-5 md:col-span-2 md:h-[480px]">
      <div ref={innerRef} className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
            style={{
              backgroundColor: `${gc}33`,
              border: `1px solid ${gc}`,
              color: gc,
            }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-white">{node.name}</h3>
            {'location' in node && node.location ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                <span aria-hidden>📍</span>
                {node.location}
              </p>
            ) : null}
          </div>
        </div>

        {node.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => {
              const tc = tagColor(tag)
              return (
                <span
                  key={tag}
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${tc}22`,
                    color: tc,
                    border: `1px solid ${tc}44`,
                  }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {'birthday' in node && node.birthday ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] tracking-widest text-gray-500 uppercase">
                🎂 Birthday
              </span>
              <span className="text-sm text-gray-200">{node.birthday}</span>
            </div>
          ) : null}
          {'met' in node && node.met ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] tracking-widest text-gray-500 uppercase">
                ✦ Met
              </span>
              <span className="text-sm text-gray-200">{node.met}</span>
            </div>
          ) : null}
          {'note' in node && node.note ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] tracking-widest text-gray-500 uppercase">
                📝 Note
              </span>
              <span className="text-sm text-gray-200">{node.note}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <div
            className="rounded-full px-3 py-1 text-xs"
            style={{
              alignSelf: 'flex-start',
              backgroundColor: `${community.color}15`,
              border: `1px solid ${community.color}30`,
              color: community.color,
            }}
          >
            ● {community.name}
          </div>

          <div className="flex justify-center gap-1.5 pt-2">
            {nonYouIds.map((id) => {
              const n = DEMO_NODES.find((x) => x.id === id)
              const c =
                n && n.group !== 'self'
                  ? GROUP_COLORS[n.group]
                  : '#6B7280'
              const active = id === activeNodeId
              return (
                <span
                  key={id}
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: active ? c : 'transparent',
                    border: `1px solid ${active ? c : '#6B7280'}`,
                  }}
                  aria-hidden
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

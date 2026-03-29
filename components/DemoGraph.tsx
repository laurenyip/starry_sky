'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsDark } from '@/hooks/use-is-dark'
import type { ForceGraphMethods } from 'react-force-graph-2d'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[320px] w-full animate-pulse rounded-2xl bg-gray-50 dark:bg-[#080B14] md:h-[480px]"
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
  const isDark = useIsDark()
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  const graphBg = isDark ? '#080B14' : '#F9FAFB'

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
      let hex = GROUP_COLORS[g] ?? '#A78BFA'
      if (g === 'self' && !isDarkRef.current) hex = '#7C3AED'
      if (hex.length === 7) return `${hex}30`
      return hex
    },
    [nodeById]
  )

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode
      const dark = isDarkRef.current
      const baseColor = GROUP_COLORS[n.group] ?? '#A78BFA'
      const color =
        n.group === 'self' ? (dark ? '#FFFFFF' : '#7C3AED') : baseColor
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
      if (n.group === 'self') {
        ctx.fillStyle = dark
          ? 'rgba(15, 23, 42, 0.9)'
          : 'rgba(255, 255, 255, 0.95)'
      } else {
        ctx.fillStyle = dark
          ? 'rgba(255, 255, 255, 0.85)'
          : 'rgba(17, 24, 39, 0.88)'
      }
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
          ctx.fillStyle = isDarkRef.current
            ? `rgba(255,255,255,${clamped})`
            : `rgba(75,85,99,${clamped * 0.55})`
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

  return (
    <div
      ref={sectionRef}
      className={`relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 transition-opacity duration-[800ms] ease-out ${
        sectionVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="mx-auto w-full max-w-5xl px-4">
        <div
          ref={graphWrapRef}
          className="h-[320px] overflow-hidden rounded-2xl border border-gray-200 shadow-[0_0_60px_rgba(139,92,246,0.08),0_0_120px_rgba(52,211,153,0.04)] dark:border-white/[0.08] dark:shadow-[0_0_60px_rgba(139,92,246,0.12),0_0_120px_rgba(52,211,153,0.06)] md:h-[480px]"
          style={{
            backgroundColor: graphBg,
          }}
        >
          <ForceGraph2D
            ref={fgRef}
            width={dims.width}
            height={dims.height}
            graphData={graphData}
            backgroundColor={graphBg}
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
      </div>
    </div>
  )
}

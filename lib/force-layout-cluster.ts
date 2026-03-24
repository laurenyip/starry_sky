import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from 'd3-force'

type SimNode = SimulationNodeDatum & { id: string }

/**
 * One-shot force layout inside a constellation (relative coords).
 */
export function layoutPersonNodesInCluster(
  personIds: string[],
  internalLinks: { source: string; target: string }[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const pad = 44
  const cx = width / 2
  const cy = height / 2
  const simNodes: SimNode[] = personIds.map((id, i) => ({
    id,
    x: cx + (i % 6) * 12,
    y: cy + (i % 4) * 10,
  }))
  const byId = new Map(simNodes.map((n) => [n.id, n]))
  const simLinks = internalLinks
    .map((l) => ({
      source: byId.get(l.source),
      target: byId.get(l.target),
    }))
    .filter(
      (l): l is { source: SimNode; target: SimNode } =>
        Boolean(l.source && l.target)
    )

  const sim = forceSimulation(simNodes)
    .force(
      'link',
      forceLink<SimNode, { source: SimNode; target: SimNode }>(simLinks)
        .id((d) => d.id)
        .distance(72)
        .strength(0.5)
    )
    .force('charge', forceManyBody<SimNode>().strength(-180))
    .force('collide', forceCollide<SimNode>().radius(36))
    .stop()

  for (let i = 0; i < 130; i++) sim.tick()

  const out = new Map<string, { x: number; y: number }>()
  for (const n of simNodes) {
    out.set(n.id, {
      x: Math.max(pad, Math.min(width - pad, n.x ?? cx)),
      y: Math.max(pad, Math.min(height - pad, n.y ?? cy)),
    })
  }
  return out
}

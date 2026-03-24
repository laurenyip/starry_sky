/** Pastel fills for community constellation regions (by color_index % length). */
export const COMMUNITY_PASTELS = [
  { stroke: '#c4b5fd', fill: 'rgba(196, 181, 253, 0.22)', glow: 'rgba(139, 92, 246, 0.35)' },
  { stroke: '#a5d8ff', fill: 'rgba(165, 216, 255, 0.22)', glow: 'rgba(59, 130, 246, 0.3)' },
  { stroke: '#b2f2bb', fill: 'rgba(178, 242, 187, 0.22)', glow: 'rgba(34, 197, 94, 0.28)' },
  { stroke: '#ffc9c9', fill: 'rgba(255, 201, 201, 0.25)', glow: 'rgba(248, 113, 113, 0.3)' },
  { stroke: '#ffec99', fill: 'rgba(255, 236, 153, 0.28)', glow: 'rgba(234, 179, 8, 0.28)' },
  { stroke: '#fcc2d7', fill: 'rgba(252, 194, 215, 0.25)', glow: 'rgba(236, 72, 153, 0.28)' },
  { stroke: '#99e9f2', fill: 'rgba(153, 233, 242, 0.22)', glow: 'rgba(6, 182, 212, 0.28)' },
  { stroke: '#d0bfff', fill: 'rgba(208, 191, 255, 0.22)', glow: 'rgba(124, 58, 237, 0.25)' },
] as const

export function communityStyle(colorIndex: number) {
  return COMMUNITY_PASTELS[Math.abs(colorIndex) % COMMUNITY_PASTELS.length]
}

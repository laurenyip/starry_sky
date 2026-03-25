/** Colours for node borders: relation between the graph owner and that person (edge.relation_type). */
export const RELATION_TYPE_COLOR_MAP = {
  family: '#FF4D4D',
  friend: '#FFD700',
  acquaintance: '#A8D8EA',
  colleague: '#A29BFE',
  mentor: '#00B894',
  other: '#AAAAAA',
} as const

export type CanonicalRelationType = keyof typeof RELATION_TYPE_COLOR_MAP

export const RELATION_TYPE_ORDER: CanonicalRelationType[] = [
  'family',
  'friend',
  'acquaintance',
  'colleague',
  'mentor',
  'other',
]

const DEFAULT_RELATION_BORDER = RELATION_TYPE_COLOR_MAP.other

/** Border colour for relation_type stored on edges; unknown / empty → grey. */
export function relationTypeToBorderColor(
  relationType: string | null | undefined
): string {
  if (relationType == null || relationType === '') return DEFAULT_RELATION_BORDER
  const k = relationType.trim().toLowerCase()
  if (
    k in RELATION_TYPE_COLOR_MAP &&
    RELATION_TYPE_COLOR_MAP[k as CanonicalRelationType]
  ) {
    return RELATION_TYPE_COLOR_MAP[k as CanonicalRelationType]
  }
  return DEFAULT_RELATION_BORDER
}

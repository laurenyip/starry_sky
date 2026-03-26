/** Easy-to-edit mapping used across node rings and panel avatars. */
export const RELATION_COLOURS = {
  family: '#FF4D4D',
  friend: '#FFD700',
  acquaintance: '#A8D8EA',
  colleague: '#A29BFE',
  mentor: '#00B894',
  other: '#AAAAAA',
} as const

/** Backward-compatible alias for existing imports. */
export const RELATION_TYPE_COLOR_MAP = RELATION_COLOURS

export type CanonicalRelationType = keyof typeof RELATION_COLOURS

export const RELATION_TYPE_ORDER: CanonicalRelationType[] = [
  'family',
  'friend',
  'acquaintance',
  'colleague',
  'mentor',
  'other',
]

const DEFAULT_RELATION_BORDER = RELATION_COLOURS.other

/** Border colour for relation_type stored on edges; unknown / empty → grey. */
export function relationTypeToBorderColor(
  relationType: string | null | undefined
): string {
  if (relationType == null || relationType === '') return DEFAULT_RELATION_BORDER
  const k = relationType.trim().toLowerCase()
  if (
    k in RELATION_COLOURS &&
    RELATION_COLOURS[k as CanonicalRelationType]
  ) {
    return RELATION_COLOURS[k as CanonicalRelationType]
  }
  return DEFAULT_RELATION_BORDER
}

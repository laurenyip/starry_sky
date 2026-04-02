import { z } from 'zod'
import { sanitize } from '@/lib/api/sanitize'

const sanitizedString = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .transform((s) => sanitize(s))
    .refine((s) => s.length >= min, { message: 'Required' })

const sanitizedStringOptional = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => sanitize(s))
    .optional()
    .nullable()

export const NodeSchema = z.object({
  name: sanitizedString(1, 100),
  location_id: z.string().uuid().optional().nullable(),
  relationship: z
    .enum([
      'friend',
      'family',
      'acquaintance',
      'colleague',
      'network',
      'romantic',
      'mentor',
    ])
    .optional()
    .nullable(),
  things_to_remember: sanitizedStringOptional(2000),
  custom_attributes: z
    .record(z.string().max(100), z.string().max(500))
    .optional()
    .nullable(),
  avatar_url: z.string().url().optional().nullable(),
})

export const LocationSchema = z.object({
  name: sanitizedString(1, 100),
})

export const ConstellationSchema = z.object({
  name: sanitizedString(1, 100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  color_index: z.number().int().min(0).max(20).optional(),
})

export const EdgeSchema = z.object({
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
  relationship_label: z
    .string()
    .max(100)
    .transform((s) => sanitize(s))
    .optional()
    .nullable(),
})

export const AiExtractNodesSchema = z.object({
  text: z.string().min(1).max(100_000).transform((s) => sanitize(s)),
})


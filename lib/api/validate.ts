import { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'
import { z } from 'zod'

export async function readJson<T>(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

export async function parseBodyOr400<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const raw = await readJson(req)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data: parsed.data }
}

export { z }


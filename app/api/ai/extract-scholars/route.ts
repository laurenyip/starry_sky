import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured on the server.' },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => null)
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    const customFields = Array.isArray(body?.customFields)
      ? body.customFields
          .map((f: unknown) => String(f ?? '').trim())
          .filter(Boolean)
      : []

    if (!text) {
      return NextResponse.json({ error: 'No text provided.' }, { status: 400 })
    }

    const baseFields = [
      'name',
      'photo_url',
      'birthday',
      'location',
      'cohort',
      'interests',
      'discord',
      'email',
    ]
    const allFields = [...baseFields, ...customFields]
    const schemaHint = allFields.map((f) => `"${f}": string | null`).join(',\n  ')

    const systemPrompt = `You are a strict data extraction assistant.
Return ONLY a raw JSON array with no markdown and no explanation.
Each array item must be an object with these keys:
{
  ${schemaHint}
}
Include all keys for every item. Unknown values should be null.
Do not include extra keys.`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    )

    const payload = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }

    const rawText =
      payload?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text ?? '')
        .join('') ?? ''

    const raw = String(rawText).trim()
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    const jsonSlice =
      start >= 0 && end >= 0 && end > start ? raw.slice(start, end + 1) : raw

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonSlice)
    } catch {
      return NextResponse.json(
        { error: 'Could not parse — try rephrasing your input.' },
        { status: 422 }
      )
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Could not parse — try rephrasing your input.' },
        { status: 422 }
      )
    }

    const people = parsed.map((item) => {
      const src =
        item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {}
      const out: Record<string, string | null> = {}
      for (const key of allFields) {
        const value = src[key]
        out[key] = value == null ? null : String(value)
      }
      return out
    })

    return NextResponse.json({ people })
  } catch (e) {
    console.error('[extract-scholars]', e)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

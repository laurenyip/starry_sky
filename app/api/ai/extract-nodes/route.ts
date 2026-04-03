import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT =
  'You are a data extraction assistant. Extract all people mentioned in the text and return ONLY a valid JSON array, no markdown, no explanation. Each object should have these fields:\n{\n  "name": string,\n  "relationship": one of ["friend","family","acquaintance","colleague","network","romantic","mentor","enemy","partner"] or null,\n  "location": string or null,\n  "things_to_remember": string or null,\n  "custom_attributes": object or null\n}\nOnly include people, not organizations. If a field is unknown leave it null. Most general information can go into things_to_remember, custom_attributes is for stuff like birthday, contact information, favourite food, etc. For text similar to "Jan 7" or "feb 23" recognize those as an important date and put it into attributes.'

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
    const text = body?.text
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'No text provided.' }, { status: 400 })
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
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

    let arr: unknown
    try {
      arr = JSON.parse(jsonSlice)
    } catch {
      return NextResponse.json(
        { error: 'Could not parse Gemini response as JSON.' },
        { status: 422 }
      )
    }

    if (!Array.isArray(arr)) {
      return NextResponse.json(
        { error: 'Gemini response was not a JSON array.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ people: arr })
  } catch (e) {
    console.error('[extract-nodes]', e)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

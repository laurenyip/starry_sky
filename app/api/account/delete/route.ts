import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Deletes the authenticated user via service role (requires SUPABASE_SERVICE_ROLE_KEY).
 * Public tables cascade from auth.users → profiles → nodes/edges/etc.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const jwt = authHeader.slice('Bearer '.length).trim()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const supabaseAnon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(jwt)

  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      {
        error:
          'Account deletion is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.',
      },
      { status: 500 },
    )
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

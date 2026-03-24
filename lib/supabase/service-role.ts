import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only client that bypasses RLS. Used for public profile graphs.
 * Set SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard → Settings → API).
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

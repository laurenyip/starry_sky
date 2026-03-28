import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Keeps the "You" node avatar in sync with `profiles.avatar_url`.
 */
export async function syncSelfNodeAvatarWithProfile(
  supabase: SupabaseClient,
  ownerId: string,
  avatarUrl: string | null
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('nodes')
    .update({ avatar_url: avatarUrl })
    .eq('owner_id', ownerId)
    .eq('is_self', true)
  if (error) {
    console.error('[syncSelfNodeAvatarWithProfile]', error)
    return { error: new Error(error.message) }
  }
  return { error: null }
}

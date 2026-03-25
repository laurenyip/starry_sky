import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { DbEdge, DbLocation, DbPerson } from '@/lib/flow-build'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { PublicProfileGraph, type PublicGraphPayload } from './public-graph'

type PageProps = { params: Promise<{ username: string }> }

async function getProfileUsernameOnly(
  username: string
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await anon
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle()

  if (error || !data) return null
  return data.username as string
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username: raw } = await params
  const username = decodeURIComponent(raw)
  const display = await getProfileUsernameOnly(username)

  if (!display) {
    return {
      title: 'Profile not found',
      description: 'This FriendGraph profile does not exist.',
    }
  }

  return {
    title: `${display}'s Friend Graph`,
    description: `View ${display}'s relationship graph on FriendGraph.`,
    openGraph: {
      title: `${display}'s Friend Graph`,
      description: `View ${display}'s relationship graph on FriendGraph.`,
      type: 'profile',
    },
  }
}

type LoadOk = {
  ok: true
  username: string
  profileAvatarUrl: string | null
  graphData: PublicGraphPayload
  usedServiceRole: boolean
  fetchError: PostgrestError | null
}

type LoadFail =
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'error'; message: string }

async function loadProfileAndGraph(
  username: string
): Promise<LoadOk | LoadFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return {
      ok: false,
      kind: 'error',
      message:
        'Supabase URL or anon key is missing. Check your environment configuration.',
    }
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileError } = await anon
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('username', username)
    .maybeSingle()

  if (profileError) {
    return { ok: false, kind: 'error', message: profileError.message }
  }
  if (!profile) {
    return { ok: false, kind: 'not_found' }
  }

  const service = createServiceRoleClient()
  const db = service ?? anon

  const [locsRes, nodesRes, edgesRes, commRes] = await Promise.all([
    db
      .from('locations')
      .select('id,name,user_id')
      .eq('user_id', profile.id)
      .order('name'),
    db
      .from('nodes')
      .select(
        'id,name,owner_id,location_id,relationship,things_to_remember,custom_attributes,position_x,position_y,pos_x,pos_y,avatar_url,is_self'
      )
      .eq('owner_id', profile.id),
    db
      .from('edges')
      .select(
        'id,owner_id,source_node_id,target_node_id,label,community_id,relation_type'
      )
      .eq('owner_id', profile.id),
    db
      .from('communities')
      .select('id,color')
      .eq('owner_id', profile.id),
  ])

  const fetchErr =
    locsRes.error ??
    nodesRes.error ??
    edgesRes.error ??
    commRes.error ??
    null

  const locations = (locsRes.data ?? []) as DbLocation[]
  const rawPeople = (nodesRes.data ?? []) as Record<string, unknown>[]
  const people: DbPerson[] = rawPeople.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    location_id: (r.location_id as string | null) ?? null,
    relationship: String(r.relationship ?? 'friend'),
    things_to_remember: String(r.things_to_remember ?? ''),
    custom_attributes:
      (r.custom_attributes as Record<string, unknown> | null) ?? {},
    position_x:
      r.position_x == null ? null : Number(r.position_x as number),
    position_y:
      r.position_y == null ? null : Number(r.position_y as number),
    pos_x: r.pos_x == null ? null : Number(r.pos_x as number),
    pos_y: r.pos_y == null ? null : Number(r.pos_y as number),
    avatar_url:
      r.avatar_url == null || r.avatar_url === ''
        ? null
        : String(r.avatar_url),
    is_self: Boolean(r.is_self),
  }))

  const edges: DbEdge[] = (edgesRes.data ?? []).map((e) => {
    const row = e as Record<string, unknown>
    const cid = row.community_id
    const rt = row.relation_type
    return {
      id: e.id as string,
      source_node_id: e.source_node_id as string,
      target_node_id: e.target_node_id as string,
      label: String(e.label ?? 'friend'),
      community_id:
        cid == null || cid === '' ? null : String(cid),
      relation_type:
        rt == null || rt === ''
          ? null
          : String(rt).trim().toLowerCase(),
    }
  })

  const communityColors: Record<string, string> = {}
  for (const row of commRes.data ?? []) {
    const r = row as { id: string; color: string }
    if (r?.id && r?.color) communityColors[r.id] = r.color
  }

  const graphData: PublicGraphPayload = {
    locations,
    people,
    edges,
    communityColors,
  }

  const rawAv = (profile as { avatar_url?: unknown }).avatar_url
  const profileAvatarUrl =
    rawAv == null || rawAv === '' ? null : String(rawAv)

  return {
    ok: true,
    username: profile.username as string,
    profileAvatarUrl,
    graphData,
    usedServiceRole: Boolean(service),
    fetchError: fetchErr,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username: raw } = await params
  const username = decodeURIComponent(raw)

  const result = await loadProfileAndGraph(username)

  if (!result.ok) {
    if (result.kind === 'not_found') {
      notFound()
    }
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-4 py-16">
        <h1 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {result.message}
        </p>
      </div>
    )
  }

  const {
    username: displayUsername,
    profileAvatarUrl,
    graphData,
    usedServiceRole,
    fetchError,
  } = result

  const headerInitial = displayUsername.slice(0, 1).toUpperCase()

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-zinc-200 bg-background/90 px-4 py-5 dark:border-zinc-800 sm:px-6 sm:py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
            {profileAvatarUrl ? (
              <Image
                src={profileAvatarUrl}
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-zinc-500 dark:text-zinc-400">
                {headerInitial}
              </span>
            )}
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {displayUsername}&apos;s Friend Graph
            </h1>
            {fetchError && !usedServiceRole ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                Graph data could not be loaded. Set{' '}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>{' '}
                in{' '}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                  .env.local
                </code>{' '}
                (server-only; never use it in client code).
              </p>
            ) : fetchError ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {fetchError.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-h-[50vh] flex-1 flex-col px-2 pb-4 pt-2 sm:px-4">
        <PublicProfileGraph graphData={graphData} />
      </div>
    </div>
  )
}

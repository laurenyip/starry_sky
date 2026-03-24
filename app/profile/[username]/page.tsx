import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  PublicProfileGraph,
  type PublicGraphLink,
  type PublicGraphNode,
} from './public-graph'

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
  graphData: { nodes: PublicGraphNode[]; links: PublicGraphLink[] }
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
    .select('id, username')
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

  const [nodesRes, edgesRes] = await Promise.all([
    db.from('nodes').select('id, name, attributes').eq('owner_id', profile.id),
    db
      .from('edges')
      .select('id, source_node_id, target_node_id, label')
      .eq('owner_id', profile.id),
  ])

  const rawNodes = nodesRes.data ?? []
  const rawEdges = edgesRes.data ?? []

  const fetchErr = nodesRes.error ?? edgesRes.error ?? null

  const nodes: PublicGraphNode[] = rawNodes.map((n) => {
    const attributes = (n.attributes as Record<string, unknown>) ?? {}
    return {
      id: n.id,
      name: n.name,
      ...attributes,
    }
  })

  const links: PublicGraphLink[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label,
  }))

  return {
    ok: true,
    username: profile.username as string,
    graphData: { nodes, links },
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

  const { username: displayUsername, graphData, usedServiceRole, fetchError } =
    result

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-zinc-200 bg-background/90 px-4 py-5 dark:border-zinc-800 sm:px-6 sm:py-6">
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

      <div className="flex min-h-0 min-h-[50vh] flex-1 flex-col">
        <PublicProfileGraph graphData={graphData} />
      </div>
    </div>
  )
}

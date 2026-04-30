'use client'

import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type DirectoryRow = { id: string; name: string; published: boolean }

export default function SharedPagesIndex() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<DirectoryRow[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      setUserId(data.session?.user?.id ?? null)
    })()
  }, [supabase])

  useEffect(() => {
    if (!userId) return
    void (async () => {
      setLoading(true)
      const { data, error: e } = await supabase
        .from('directories')
        .select('id,name,published')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
      setLoading(false)
      if (e) {
        setError(e.message)
        return
      }
      setRows((data as DirectoryRow[]) ?? [])
    })()
  }, [supabase, userId])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Shared Pages</h1>
        <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          + Create Shared Page
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm text-zinc-500">No shared pages yet.</p> : null}
        {rows.map((d) => (
          <Link key={d.id} href={`/shared/${encodeURIComponent(d.id)}`} className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
            <p className="font-medium">{d.name}</p>
            <p className="mt-1 text-xs text-zinc-500">{d.published ? 'Published' : 'Draft'}</p>
          </Link>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold">Create Shared Page</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Page name" className="mt-3 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  if (!userId || !name.trim()) return
                  const { data, error: e } = await supabase
                    .from('directories')
                    .insert({ owner_id: userId, name: name.trim(), published: false })
                    .select('id')
                    .single()
                  if (e) {
                    setError(e.message)
                    return
                  }
                  const id = String((data as { id?: string })?.id ?? '')
                  setOpen(false)
                  setName('')
                  if (id) router.push(`/shared/${encodeURIComponent(id)}`)
                }}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


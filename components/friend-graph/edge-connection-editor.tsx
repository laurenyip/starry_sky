'use client'

import type { DbEdge, DbPerson } from '@/lib/flow-build'
import {
  RELATION_TYPES,
  legacyRelationTypeToTags,
  legacyTagToRelationTypeLegacyField,
  normalizeRelationTags,
  relationTagPickerClass,
} from '@/lib/relation-types'
import type { Edge } from '@xyflow/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

const POPUP_W = 280

function personInitial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

function useNarrowSheet(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return narrow
}

export function EdgeConnectionEditor(props: {
  open: boolean
  flowEdge: Edge | null
  clickClient: { x: number; y: number } | null
  dbEdges: DbEdge[]
  people: DbPerson[]
  supabase: SupabaseClient
  userId: string
  onClose: () => void
  onAfterSave: () => Promise<void>
  onDeleteConnection: () => Promise<void>
}) {
  const {
    open,
    flowEdge,
    clickClient,
    dbEdges,
    people,
    supabase,
    userId,
    onClose,
    onAfterSave,
    onDeleteConnection,
  } = props

  const isMobile = useNarrowSheet()
  const popupRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [draftTags, setDraftTags] = useState<string[]>([])
  const [draftNote, setDraftNote] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [sheetEntered, setSheetEntered] = useState(false)

  const raw = flowEdge ? dbEdges.find((d) => d.id === flowEdge.id) : undefined

  useEffect(() => {
    if (!open || !flowEdge) return
    const row = dbEdges.find((d) => d.id === flowEdge.id)
    if (!row) return
    let tags: string[] = []
    if (Array.isArray(row.relation_types) && row.relation_types.length) {
      tags = normalizeRelationTags((row.relation_types as string[]) ?? [])
    } else if (row.relation_type) {
      tags = normalizeRelationTags(legacyRelationTypeToTags(row.relation_type))
    }
    setDraftTags(tags)
    setDraftNote(row.label ?? '')
    setSaveError(null)
    setSavedFlash(false)
  }, [open, flowEdge?.id, dbEdges])

  useLayoutEffect(() => {
    if (!open || isMobile || !clickClient) return
    const measure = () => {
      const el = popupRef.current
      const h = el?.offsetHeight ?? 360
      let left = clickClient.x + 12
      let top = clickClient.y - 20
      if (left + POPUP_W > window.innerWidth - 8) {
        left = clickClient.x - POPUP_W - 12
      }
      if (top + h > window.innerHeight - 8) {
        top = window.innerHeight - h - 8
      }
      if (left < 8) left = 8
      if (top < 8) top = 8
      setPos({ left, top })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, isMobile, clickClient, draftTags, draftNote, savedFlash])

  useEffect(() => {
    if (!open || !isMobile) {
      setSheetEntered(false)
      return
    }
    const id = requestAnimationFrame(() => setSheetEntered(true))
    return () => cancelAnimationFrame(id)
  }, [open, isMobile])

  useEffect(() => {
    if (!open || isMobile) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popupRef.current && !popupRef.current.contains(t)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, isMobile, onClose])

  const personById = useCallback(
    (id: string) => people.find((p) => p.id === id),
    [people]
  )

  const save = useCallback(async () => {
    if (!raw) return
    setSaving(true)
    setSaveError(null)
    const normalized = normalizeRelationTags(draftTags)
    const legacy = legacyTagToRelationTypeLegacyField(normalized[0] ?? null)
    const label = draftNote.trim() || null
    const a = raw.source_node_id
    const b = raw.target_node_id
    const rev = dbEdges.find((d) => d.source_node_id === b && d.target_node_id === a)
    const ids = [raw.id, rev?.id].filter(Boolean) as string[]
    if (ids.length === 0) {
      setSaving(false)
      setSaveError('Could not find edge pair.')
      return
    }
    const { error } = await supabase
      .from('edges')
      .update({
        relation_types: normalized,
        relation_type: legacy,
        label,
      })
      .eq('owner_id', userId)
      .in('id', ids)
    setSaving(false)
    if (error) {
      setSaveError(error.message || 'Failed to save')
      return
    }
    setSavedFlash(true)
    await onAfterSave()
    window.setTimeout(() => {
      setSavedFlash(false)
      onClose()
    }, 700)
  }, [
    raw,
    draftTags,
    draftNote,
    dbEdges,
    supabase,
    userId,
    onAfterSave,
    onClose,
  ])

  const handleDelete = useCallback(() => {
    if (!window.confirm('Delete this connection?')) return
    void (async () => {
      try {
        await onDeleteConnection()
      } catch {
        setSaveError('Failed to delete')
      }
    })()
  }, [onDeleteConnection])

  if (!open || !flowEdge || !raw) return null

  const pa = personById(raw.source_node_id)
  const pb = personById(raw.target_node_id)
  const nameA = pa?.name ?? 'Unknown'
  const nameB = pb?.name ?? 'Unknown'

  const headerPeople = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-[11px] font-semibold text-gray-700 dark:border-white/15 dark:bg-white/10 dark:text-white">
          {pa?.avatar_url ? (
            <Image
              src={pa.avatar_url}
              alt=""
              width={28}
              height={28}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            personInitial(nameA)
          )}
        </span>
        <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
          {nameA}
        </span>
      </div>
      <span
        className="shrink-0 px-0.5 text-[10px] font-medium tracking-tight text-gray-400 dark:text-gray-500"
        aria-hidden
      >
        ←——→
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-right text-sm font-medium text-gray-900 dark:text-white">
          {nameB}
        </span>
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-[11px] font-semibold text-gray-700 dark:border-white/15 dark:bg-white/10 dark:text-white">
          {pb?.avatar_url ? (
            <Image
              src={pb.avatar_url}
              alt=""
              width={28}
              height={28}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            personInitial(nameB)
          )}
        </span>
      </div>
    </div>
  )

  const formInner = (
    <>
      {headerPeople}

      <div className="mt-4">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Relationship
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(RELATION_TYPES as unknown as string[]).map((tag) => {
            const selected = draftTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                className={relationTagPickerClass(selected)}
                onClick={() => {
                  const next = selected
                    ? draftTags.filter((t) => t !== tag)
                    : [...draftTags, tag]
                  setDraftTags(normalizeRelationTags(next))
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Note
        </label>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          placeholder="Add a note about this connection..."
          rows={2}
          className="mt-2 w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-gray-400/20 transition-colors duration-300 ease-in-out placeholder:text-gray-400 focus:ring-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500"
        />
      </div>

      {saveError ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {saveError}
        </p>
      ) : null}
      {savedFlash ? (
        <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Saved ✓
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving || savedFlash}
        onClick={() => void save()}
        className="mt-4 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-gray-900"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="mt-3 w-full text-center text-xs font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
      >
        Delete connection
      </button>
    </>
  )

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          aria-label="Close"
          className="fixed inset-0 z-40 bg-black/45"
          onClick={onClose}
        />
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-4 shadow-xl transition-transform duration-[250ms] ease-out dark:border-gray-800 dark:bg-gray-900 ${
            sheetEntered ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-gray-300 dark:bg-gray-700" />
          <div className="relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute -right-1 -top-1 rounded-full p-1.5 text-lg leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label="Close"
            >
              ×
            </button>
            {formInner}
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 w-[280px] rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      style={{ left: pos.left, top: pos.top }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 rounded-full p-1.5 text-lg leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        aria-label="Close"
      >
        ×
      </button>
      <div className="pr-6">{formInner}</div>
    </div>
  )
}

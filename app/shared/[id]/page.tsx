'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { SharedGraphWorkspace } from '@/components/directory/SharedGraphWorkspace'
import { GraphSearchBar } from '@/components/graph/graph-search-bar'
import Papa from 'papaparse'
import * as mammoth from 'mammoth'

type PersonalNode = {
  id: string
  name: string
  avatar_url: string | null
  location_id: string | null
  things_to_remember: string | null
  custom_attributes: Record<string, unknown> | null
}

type DirectoryNode = {
  id: string
  name: string
}

const BASE_DIRECTORY_FIELDS = [
  'name',
  'photo_url',
  'birthday',
  'location',
  'cohort',
  'interests',
  'discord',
  'email',
] as const

type PreviewRow = Record<string, string>

export default function SharedDirectoryPage() {
  const params = useParams<{ id: string }>()
  const directoryId = params.id
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [directoryName, setDirectoryName] = useState('Shared Page')
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personalNodes, setPersonalNodes] = useState<PersonalNode[]>([])
  const [importedNodes, setImportedNodes] = useState<DirectoryNode[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importAiOpen, setImportAiOpen] = useState(false)
  const [importAiBusy, setImportAiBusy] = useState(false)
  const [importAiText, setImportAiText] = useState('')
  const [importAiFileName, setImportAiFileName] = useState<string | null>(null)
  const [customFields, setCustomFields] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [canvasRefreshToken, setCanvasRefreshToken] = useState(0)
  const [brandingOpen, setBrandingOpen] = useState(false)
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [newCustomField, setNewCustomField] = useState('')
  const [backgroundColor, setBackgroundColor] = useState('#0a0a0f')
  const [backgroundColorInput, setBackgroundColorInput] = useState('#0a0a0f')
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null)
  const [overlayPosition, setOverlayPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('center')
  const [overlayOpacity, setOverlayOpacity] = useState(0.15)
  const [overlaySize, setOverlaySize] = useState(128)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishSaving, setPublishSaving] = useState(false)
  const [publishPassword, setPublishPassword] = useState('')
  const [published, setPublished] = useState(false)
  const [slug, setSlug] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph')
  const [groupingLabel1, setGroupingLabel1] = useState('Locations')
  const [groupingLabel2, setGroupingLabel2] = useState('Constellations')

  useEffect(() => {
    if (!directoryId) return
    let active = true
    const loadName = async () => {
      const withGrouping = await supabase
        .from('directories')
        .select(
          'name,background_color,overlay_image_url,overlay_position,overlay_opacity,published,slug,grouping_label_1,grouping_label_2'
        )
        .eq('id', directoryId)
        .maybeSingle()
      const fallback = withGrouping.error
        ? await supabase
            .from('directories')
            .select('name,background_color,overlay_image_url,overlay_position,overlay_opacity,published,slug')
            .eq('id', directoryId)
            .maybeSingle()
        : null
      const data = (withGrouping.data ?? fallback?.data) as
        | {
            name?: string
            background_color?: string
            overlay_image_url?: string
            overlay_position?: string
            overlay_opacity?: number
            published?: boolean
            slug?: string
            grouping_label_1?: string
            grouping_label_2?: string
          }
        | null
      if (!active) return
      setDirectoryName(data?.name ?? 'Shared Page')
      setPublished(Boolean(data?.published))
      setSlug(typeof data?.slug === 'string' && data.slug ? data.slug : null)
      const loadedBackgroundColor = normalizeHexColor(String(data?.background_color ?? ''))
      setBackgroundColor(loadedBackgroundColor ?? '#0a0a0f')
      setOverlayImageUrl(
        typeof data?.overlay_image_url === 'string' && data.overlay_image_url
          ? data.overlay_image_url
          : null
      )
      const position = String(data?.overlay_position ?? 'center')
      if (
        position === 'top-left' ||
        position === 'top-right' ||
        position === 'bottom-left' ||
        position === 'bottom-right' ||
        position === 'center'
      ) {
        setOverlayPosition(
          position as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
        )
      } else {
        setOverlayPosition('center')
      }
      const opacity = Number(data?.overlay_opacity ?? 0.15)
      setOverlayOpacity(Number.isFinite(opacity) ? Math.min(0.5, Math.max(0.05, opacity)) : 0.15)
      setGroupingLabel1(
        typeof data?.grouping_label_1 === 'string' && data.grouping_label_1.trim()
          ? data.grouping_label_1
          : 'Locations'
      )
      setGroupingLabel2(
        typeof data?.grouping_label_2 === 'string' && data.grouping_label_2.trim()
          ? data.grouping_label_2
          : 'Constellations'
      )
    }
    void loadName()
    return () => {
      active = false
    }
  }, [directoryId, supabase])

  useEffect(() => {
    if (!directoryId) return
    try {
      const stored = localStorage.getItem(`shared_overlay_size:${directoryId}`)
      const parsed = stored ? Number(stored) : Number.NaN
      if (Number.isFinite(parsed)) {
        setOverlaySize(Math.min(320, Math.max(64, parsed)))
      }
    } catch {
      // ignore local storage errors
    }
  }, [directoryId])

  useEffect(() => {
    if (!directoryId) return
    try {
      localStorage.setItem(`shared_overlay_size:${directoryId}`, String(overlaySize))
    } catch {
      // ignore local storage errors
    }
  }, [directoryId, overlaySize])

  useEffect(() => {
    if (!directoryId) return
    let active = true
    const loadCustomFields = async () => {
      const { data } = await supabase
        .from('directory_custom_fields')
        .select('field_name')
        .eq('directory_id', directoryId)
        .order('field_order', { ascending: true })
      if (!active) return
      const fields = (data ?? [])
        .map((row) => String((row as { field_name: unknown }).field_name))
        .filter(Boolean)
      setCustomFields(fields)
    }
    void loadCustomFields()
    return () => {
      active = false
    }
  }, [directoryId, supabase])

  const allDirectoryFields = useMemo(
    () => [...BASE_DIRECTORY_FIELDS, ...customFields],
    [customFields]
  )

  const alreadyImportedNameSet = useMemo(
    () =>
      new Set(
        importedNodes.map((n) => n.name.trim().toLowerCase()).filter(Boolean)
      ),
    [importedNodes]
  )

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return personalNodes
    return personalNodes.filter((n) => n.name.toLowerCase().includes(q))
  }, [personalNodes, search])

  const selectableFilteredIds = useMemo(
    () =>
      filteredNodes
        .filter((n) => !alreadyImportedNameSet.has(n.name.trim().toLowerCase()))
        .map((n) => n.id),
    [filteredNodes, alreadyImportedNameSet]
  )

  const allFilteredSelected =
    selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every((id) => selectedIds.has(id))

  const rebuildDirectoryConstellations = async () => {
    const { data: nodeRows, error: nodeError } = await supabase
      .from('directory_nodes')
      .select('id,location,cohort')
      .eq('directory_id', directoryId)
    if (nodeError) throw nodeError

    await supabase
      .from('directory_node_constellations')
      .delete()
      .eq('directory_id', directoryId)
    await supabase
      .from('directory_constellations')
      .delete()
      .eq('directory_id', directoryId)

    const groups = new Map<string, string[]>()
    for (const row of (nodeRows ?? []) as Array<{ id: string; location: string | null; cohort: string | null }>) {
      const location = String(row.location ?? '').trim()
      const cohort = String(row.cohort ?? '').trim()
      if (location) groups.set(`location:${location}`, [...(groups.get(`location:${location}`) ?? []), row.id])
      if (cohort) groups.set(`cohort:${cohort}`, [...(groups.get(`cohort:${cohort}`) ?? []), row.id])
    }
    if (groups.size === 0) return

    const constellationInserts = Array.from(groups.keys()).map((key) => {
      const [type, name] = key.split(':')
      return { directory_id: directoryId, name, type }
    })
    const { data: createdConstellations, error: constellationError } = await supabase
      .from('directory_constellations')
      .insert(constellationInserts)
      .select('id,name,type')
    if (constellationError) throw constellationError

    const idByKey = new Map(
      ((createdConstellations ?? []) as Array<{ id: string; name: string; type: 'location' | 'cohort' }>).map((row) => [
        `${row.type}:${row.name}`,
        row.id,
      ])
    )
    const links: Array<{ directory_id: string; node_id: string; constellation_id: string }> = []
    for (const [key, nodeIds] of groups.entries()) {
      const constellationId = idByKey.get(key)
      if (!constellationId) continue
      for (const nodeId of nodeIds) {
        links.push({ directory_id: directoryId, node_id: nodeId, constellation_id: constellationId })
      }
    }
    if (links.length > 0) {
      const { error: linkError } = await supabase
        .from('directory_node_constellations')
        .insert(links)
      if (linkError) throw linkError
    }
  }

  const openImportModal = async () => {
    setImportOpen(true)
    setLoading(true)
    setError(null)
    setSelectedIds(new Set())
    setSearch('')

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const ownerId = session?.user?.id ?? null
    if (!ownerId) {
      setError('You must be logged in to import.')
      setLoading(false)
      return
    }

    const [personalRes, importedRes] = await Promise.all([
      supabase
        .from('nodes')
        .select(
          'id,name,avatar_url,location_id,things_to_remember,custom_attributes'
        )
        .eq('owner_id', ownerId)
        .order('name'),
      supabase
        .from('directory_nodes')
        .select('id,name')
        .eq('directory_id', directoryId),
    ])

    setLoading(false)

    if (personalRes.error || importedRes.error) {
      setError(personalRes.error?.message ?? importedRes.error?.message ?? 'Failed to load nodes.')
      return
    }

    setPersonalNodes((personalRes.data as PersonalNode[]) ?? [])
    setImportedNodes((importedRes.data as DirectoryNode[]) ?? [])
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const id of selectableFilteredIds) next.delete(id)
      } else {
        for (const id of selectableFilteredIds) next.add(id)
      }
      return next
    })
  }

  const importSelected = async () => {
    if (selectedIds.size === 0) return
    setSubmitting(true)
    setError(null)

    const selected = personalNodes.filter((n) => selectedIds.has(n.id))
    const toCopy = selected.filter(
      (n) => !alreadyImportedNameSet.has(n.name.trim().toLowerCase())
    )
    if (toCopy.length === 0) {
      setSubmitting(false)
      showToast('0 nodes added (already imported).', 'success')
      return
    }

    const locationIds = Array.from(
      new Set(toCopy.map((n) => n.location_id).filter(Boolean))
    ) as string[]
    const locationNameById = new Map<string, string>()
    if (locationIds.length > 0) {
      const { data: locationRows } = await supabase
        .from('locations')
        .select('id,name')
        .in('id', locationIds)
      for (const row of locationRows ?? []) {
        locationNameById.set(String((row as { id: string }).id), String((row as { name: string }).name))
      }
    }

    const payload = toCopy.map((node, idx) => ({
      directory_id: directoryId,
      name: node.name,
      avatar_url: node.avatar_url,
      location: node.location_id ? locationNameById.get(node.location_id) ?? null : null,
      things_to_remember: node.things_to_remember ?? '',
      custom_attributes: node.custom_attributes ?? {},
      canvas_x: (idx % 6) * 220 + 100,
      canvas_y: Math.floor(idx / 6) * 180 + 100,
    }))

    const { error: insertError } = await supabase.from('directory_nodes').insert(payload)
    setSubmitting(false)
    if (insertError) {
      setError(insertError.message)
      return
    }

    try {
      await rebuildDirectoryConstellations()
      const { data: refreshedNodes } = await supabase
        .from('directory_nodes')
        .select('id,name')
        .eq('directory_id', directoryId)
      setImportedNodes((refreshedNodes as DirectoryNode[]) ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh shared graph data.')
      return
    }
    showToast(`${payload.length} node${payload.length === 1 ? '' : 's'} added.`, 'success')
    setImportOpen(false)
    setCanvasRefreshToken((v) => v + 1)
  }

  const resetAiModal = () => {
    setImportAiText('')
    setImportAiFileName(null)
    setPreviewRows([])
    setImportAiBusy(false)
  }

  const extractTextFromFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const csvText = await file.text()
      const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true })
      if (parsed.errors?.length) {
        throw new Error(parsed.errors[0]?.message || 'Failed to parse CSV')
      }
      const rows = (parsed.data ?? []) as string[][]
      return rows.map((r) => r.map((c) => String(c ?? '').trim()).join(', ')).join('\n')
    }
    if (ext === 'txt') return await file.text()
    if (ext === 'docx') {
      const ab = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: ab })
      return String((result as { value?: unknown })?.value ?? '').trim()
    }
    throw new Error('Unsupported file type')
  }

  const runAiParse = async () => {
    const text = importAiText.trim()
    if (!text) {
      showToast('Paste text or upload a file first.', 'error')
      return
    }
    setImportAiBusy(true)
    try {
      const res = await fetch('/api/ai/extract-scholars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, customFields }),
      })
      const payload = (await res.json()) as { people?: unknown[]; error?: string }
      if (!res.ok || !Array.isArray(payload.people)) {
        showToast(payload.error || 'Could not parse — try rephrasing your input.', 'error')
        return
      }
      const nextRows = payload.people.map((person) => {
        const src =
          person && typeof person === 'object' && !Array.isArray(person)
            ? (person as Record<string, unknown>)
            : {}
        const row: PreviewRow = {}
        for (const key of allDirectoryFields) {
          row[key] = src[key] == null ? '' : String(src[key])
        }
        return row
      })
      setPreviewRows(nextRows)
    } catch {
      showToast('Could not parse — try rephrasing your input.', 'error')
    } finally {
      setImportAiBusy(false)
    }
  }

  const addAiRows = async () => {
    if (previewRows.length === 0) return
    setImportAiBusy(true)
    try {
      const rows = previewRows
        .map((row, idx) => {
          const name = (row.name ?? '').trim()
          if (!name) return null
          const customAttributes: Record<string, unknown> = {}
          for (const key of customFields) {
            customAttributes[key] = (row[key] ?? '').trim()
          }
          return {
            directory_id: directoryId,
            name,
            photo_url: (row.photo_url ?? '').trim() || null,
            birthday: (row.birthday ?? '').trim() || null,
            location: (row.location ?? '').trim() || null,
            cohort: (row.cohort ?? '').trim() || null,
            interests: (row.interests ?? '').trim() || null,
            discord: (row.discord ?? '').trim() || null,
            email: (row.email ?? '').trim() || null,
            custom_attributes: customAttributes,
            canvas_x: (idx % 6) * 220 + 100,
            canvas_y: Math.floor(idx / 6) * 180 + 100,
          }
        })
        .filter(Boolean)
      if (rows.length === 0) {
        showToast('No valid rows to insert.', 'error')
        return
      }
      const { error: insertError } = await supabase
        .from('directory_nodes')
        .insert(rows)
      if (insertError) {
        showToast(insertError.message, 'error')
        return
      }
      await rebuildDirectoryConstellations()
      const { data: refreshedNodes } = await supabase
        .from('directory_nodes')
        .select('id,name')
        .eq('directory_id', directoryId)
      setImportedNodes((refreshedNodes as DirectoryNode[]) ?? [])
      showToast(`${rows.length} node${rows.length === 1 ? '' : 's'} added.`, 'success')
      setImportAiOpen(false)
      resetAiModal()
      setCanvasRefreshToken((v) => v + 1)
    } finally {
      setImportAiBusy(false)
    }
  }

  const uploadOverlayLogo = async (file: File) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      showToast(sessionError?.message ?? 'Please sign in again before uploading.', 'error')
      return
    }

    const preferredPath = `${directoryId}/logo`
    const fallbackPath = `${session.user.id}/${directoryId}/logo`
    let successfulPath: string | null = null

    const firstUpload = await supabase.storage
      .from('directory-assets')
      .upload(preferredPath, file, { upsert: true, contentType: file.type || 'image/png' })
    if (!firstUpload.error) {
      successfulPath = preferredPath
    } else {
      const secondUpload = await supabase.storage
        .from('directory-assets')
        .upload(fallbackPath, file, { upsert: true, contentType: file.type || 'image/png' })
      if (!secondUpload.error) {
        successfulPath = fallbackPath
      } else {
        showToast(
          `Logo upload failed: ${secondUpload.error.message || firstUpload.error.message}`,
          'error'
        )
        return
      }
    }

    if (!successfulPath) {
      showToast('Logo upload failed.', 'error')
      return
    }

    const { data } = supabase.storage.from('directory-assets').getPublicUrl(successfulPath)
    const liveUrl = `${data.publicUrl}?t=${Date.now()}`
    setOverlayImageUrl(liveUrl)
    setOverlayPosition('center')
    showToast('Logo uploaded.', 'success')
  }

  const addCustomFieldDraft = () => {
    const next = newCustomField.trim()
    if (!next) return
    if (customFields.some((f) => f.toLowerCase() === next.toLowerCase())) {
      showToast('Custom field already exists.', 'error')
      return
    }
    setCustomFields((prev) => [...prev, next])
    setNewCustomField('')
  }

  const removeCustomFieldDraft = (field: string) => {
    setCustomFields((prev) => prev.filter((f) => f !== field))
  }

  const normalizeHexColor = (value: string): string | null => {
    const raw = value.trim()
    if (!raw) return null
    const withHash = raw.startsWith('#') ? raw : `#${raw}`
    const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(withHash)
    if (shortMatch) {
      const hex = shortMatch[1]
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase()
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null
    return withHash.toLowerCase()
  }

  const saveBranding = async () => {
    const normalizedBackgroundColor = normalizeHexColor(backgroundColorInput)
    if (!normalizedBackgroundColor) {
      showToast('Background color must be a valid hex code (for example: #0a0a0f).', 'error')
      return
    }

    setBackgroundColor(normalizedBackgroundColor)
    setBackgroundColorInput(normalizedBackgroundColor)
    setBrandingSaving(true)
    try {
      const { error: directoryUpdateError } = await supabase
        .from('directories')
        .update({
          background_color: normalizedBackgroundColor,
          overlay_image_url: overlayImageUrl,
          overlay_position: overlayPosition,
          overlay_opacity: overlayOpacity,
          grouping_label_1: groupingLabel1.trim() || 'Locations',
          grouping_label_2: groupingLabel2.trim() || 'Constellations',
        })
        .eq('id', directoryId)
      if (directoryUpdateError) {
        showToast(directoryUpdateError.message, 'error')
        return
      }

      await supabase.from('directory_custom_fields').delete().eq('directory_id', directoryId)
      if (customFields.length > 0) {
        const inserts = customFields.map((field, idx) => ({
          directory_id: directoryId,
          field_name: field,
          field_order: idx,
        }))
        const { error: customFieldsError } = await supabase
          .from('directory_custom_fields')
          .insert(inserts)
        if (customFieldsError) {
          showToast(customFieldsError.message, 'error')
          return
        }
      }

      setBrandingOpen(false)
      showToast('Branding saved.', 'success')
    } finally {
      setBrandingSaving(false)
    }
  }

  const generateUniqueSlug = async () => {
    const base =
      directoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'shared-page'
    for (let i = 0; i < 8; i += 1) {
      const suffix = Math.random().toString(36).slice(2, 7)
      const candidate = `${base}-${suffix}`
      const { data } = await supabase
        .from('directories')
        .select('id')
        .eq('slug', candidate)
        .limit(1)
      if (!data || data.length === 0) return candidate
    }
    return `${base}-${Date.now().toString(36)}`
  }

  const publishDirectory = async () => {
    const password = publishPassword.trim()
    if (!password) {
      showToast('Password is required.', 'error')
      return
    }
    setPublishSaving(true)
    try {
      const nextSlug = slug ?? (await generateUniqueSlug())
      const { error: publishError } = await supabase
        .from('directories')
        .update({
          published: true,
          publish_password: password,
          slug: nextSlug,
        })
        .eq('id', directoryId)
      if (publishError) {
        showToast(publishError.message, 'error')
        return
      }
      setPublished(true)
      setSlug(nextSlug)
      showToast('Directory published.', 'success')
    } finally {
      setPublishSaving(false)
    }
  }

  const unpublishDirectory = async () => {
    setPublishSaving(true)
    try {
      const { error: unpublishError } = await supabase
        .from('directories')
        .update({ published: false })
        .eq('id', directoryId)
      if (unpublishError) {
        showToast(unpublishError.message, 'error')
        return
      }
      setPublished(false)
      showToast('Directory unpublished.', 'success')
    } finally {
      setPublishSaving(false)
    }
  }

  useEffect(() => {
    setBackgroundColorInput(backgroundColor)
  }, [backgroundColor])

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-[28rem] w-full min-w-0 flex-col overflow-hidden">
      <div className="relative z-30 flex shrink-0 items-center border-b border-zinc-200 bg-background px-3 py-2 shadow-sm dark:border-zinc-800">
        <div className="z-20 flex min-w-0 items-center gap-3 pr-3">
          <Link
            href="/dashboard"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Back to My Graph"
          >
            ←
          </Link>
          <h1 className="truncate text-xl font-semibold text-foreground">{directoryName}</h1>
        </div>
        <GraphSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          className="pointer-events-auto absolute left-1/2 z-10 w-[25vw] min-w-56 max-w-md -translate-x-1/2"
        />
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'graph'
                ? 'bg-white text-black dark:bg-white dark:text-black'
                : 'border border-gray-700 bg-transparent text-gray-400 hover:bg-white/5 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            ⬡ Graph
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-black dark:bg-white dark:text-black'
                : 'border border-gray-700 bg-transparent text-gray-400 hover:bg-white/5 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            ≡ List
          </button>
          <button
            type="button"
            onClick={() => setBrandingOpen(true)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-foreground hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Open branding panel"
            title="Branding"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Publish
          </button>
        </div>
      </div>
      <div className="relative z-0 flex min-h-0 flex-1 w-full overflow-hidden">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
          <div className="min-h-[24rem] flex-1 w-full">
            <SharedGraphWorkspace
              directoryId={directoryId}
              refreshToken={canvasRefreshToken}
              searchQuery={searchQuery}
              viewMode={viewMode}
              onLoadedName={setDirectoryName}
              backgroundColor={backgroundColor}
              overlayImageUrl={overlayImageUrl}
              overlayPosition={overlayPosition}
              overlayOpacity={overlayOpacity}
              overlaySize={overlaySize}
              customFields={customFields}
              groupingLabel1={groupingLabel1}
              groupingLabel2={groupingLabel2}
              onImportFromMyGraph={() => void openImportModal()}
              onImportWithAI={() => {
                setImportAiOpen(true)
                resetAiModal()
              }}
            />
          </div>
        </div>
      </div>

      {importOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-foreground">Import from My Graph</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="mt-3 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
              >
                {allFilteredSelected ? 'Clear All' : 'Select All'}
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {selectedIds.size} selected
              </span>
            </div>

            <div className="mt-3 max-h-80 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              {loading ? (
                <p className="p-3 text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
              ) : filteredNodes.length === 0 ? (
                <p className="p-3 text-sm text-zinc-500 dark:text-zinc-400">No results.</p>
              ) : (
                filteredNodes.map((node) => {
                  const imported = alreadyImportedNameSet.has(
                    node.name.trim().toLowerCase()
                  )
                  return (
                    <label
                      key={node.id}
                      className={`flex items-center gap-3 border-b border-zinc-200 px-3 py-2 last:border-b-0 dark:border-zinc-800 ${
                        imported ? 'opacity-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={imported}
                        checked={selectedIds.has(node.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(node.id)
                            else next.delete(node.id)
                            return next
                          })
                        }}
                      />
                      {node.avatar_url ? (
                        <img
                          src={node.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {node.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="flex-1 text-sm text-foreground">{node.name}</span>
                      {imported ? (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Already added
                        </span>
                      ) : null}
                    </label>
                  )
                })
              )}
            </div>

            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || selectedIds.size === 0}
                onClick={() => void importSelected()}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {submitting ? 'Adding...' : 'Add to Shared Page'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importAiOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-foreground">Import with AI</h2>
            <textarea
              value={importAiText}
              onChange={(e) => setImportAiText(e.target.value)}
              placeholder="Paste text, roster notes, or CSV content here"
              rows={7}
              className="mt-3 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
                Upload file (.csv, .txt, .docx)
                <input
                  type="file"
                  accept=".csv,.txt,.docx"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    void (async () => {
                      try {
                        const text = await extractTextFromFile(file)
                        setImportAiText(text)
                        setImportAiFileName(file.name)
                        showToast(`Loaded ${file.name}`, 'success')
                      } catch (err) {
                        showToast(
                          err instanceof Error ? err.message : 'Failed to read file.',
                          'error'
                        )
                      }
                    })()
                  }}
                />
              </label>
              {importAiFileName ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {importAiFileName}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={importAiBusy}
                onClick={() => void runAiParse()}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 disabled:opacity-60"
              >
                {importAiBusy ? 'Parsing...' : 'Parse with AI'}
              </button>
              <button
                type="button"
                disabled={importAiBusy || previewRows.length === 0}
                onClick={() => void addAiRows()}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-60"
              >
                Add to Shared Page
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportAiOpen(false)
                  resetAiModal()
                }}
                className="ml-auto rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Close
              </button>
            </div>

            {previewRows.length > 0 ? (
              <div className="mt-4 max-h-80 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                {previewRows.map((row, idx) => (
                  <div
                    key={`preview-${idx}`}
                    className="grid gap-2 border-b border-zinc-200 p-3 last:border-b-0 dark:border-zinc-800 sm:grid-cols-2"
                  >
                    {allDirectoryFields.map((field) => (
                      <label key={`${idx}-${field}`} className="text-xs">
                        <span className="mb-1 block text-zinc-500 dark:text-zinc-400">
                          {field}
                        </span>
                        <input
                          value={row[field] ?? ''}
                          onChange={(e) =>
                            setPreviewRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, [field]: e.target.value } : r
                              )
                            )
                          }
                          className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {brandingOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <form
            className="w-full max-w-xl rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800"
            onSubmit={(e) => {
              e.preventDefault()
              if (brandingSaving) return
              void saveBranding()
            }}
          >
            <h2 className="text-base font-semibold text-foreground">Branding</h2>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-foreground">Background color</h3>
              <div className="mt-2 flex items-center gap-3">
                <label className="flex-1 text-xs">
                  <span className="mb-1 block text-zinc-500 dark:text-zinc-400">Hex</span>
                  <input
                    value={backgroundColorInput}
                    placeholder="#0a0a0f"
                    onChange={(e) => {
                      const next = e.target.value
                      setBackgroundColorInput(next)
                      const normalized = normalizeHexColor(next)
                      if (normalized) setBackgroundColor(normalized)
                    }}
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => {
                    const next = e.target.value
                    setBackgroundColor(next)
                    setBackgroundColorInput(next)
                  }}
                  className="h-10 w-12 rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
                />
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-medium text-foreground">Logo overlay</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      void uploadOverlayLogo(file)
                    }}
                  />
                </label>
                {overlayImageUrl ? (
                  <button
                    type="button"
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                    onClick={() => setOverlayImageUrl(null)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500 dark:text-zinc-400">Position</span>
                  <select
                    value={overlayPosition}
                    onChange={(e) =>
                      setOverlayPosition(
                        e.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
                      )
                    }
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                  >
                    <option value="top-left">top-left</option>
                    <option value="top-right">top-right</option>
                    <option value="bottom-left">bottom-left</option>
                    <option value="bottom-right">bottom-right</option>
                    <option value="center">center</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500 dark:text-zinc-400">
                    Opacity ({overlayOpacity.toFixed(2)})
                  </span>
                  <input
                    type="range"
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500 dark:text-zinc-400">
                    Size ({overlaySize}px)
                  </span>
                  <input
                    type="range"
                    min={64}
                    max={320}
                    step={4}
                    value={overlaySize}
                    onChange={(e) => setOverlaySize(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-medium text-foreground">Custom fields</h3>
              <div className="mt-2 flex gap-2">
                <input
                  value={newCustomField}
                  onChange={(e) => setNewCustomField(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    addCustomFieldDraft()
                  }}
                  placeholder="Add field name"
                  className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={addCustomFieldDraft}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 max-h-40 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                {customFields.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No custom fields.</p>
                ) : (
                  customFields.map((field) => (
                    <div key={field} className="mb-1 flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <span>{field}</span>
                      <button
                        type="button"
                        className="text-xs text-red-500"
                        onClick={() => removeCustomFieldDraft(field)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-medium text-foreground">Grouping Labels</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500 dark:text-zinc-400">
                    Group 1 Label
                  </span>
                  <input
                    value={groupingLabel1}
                    onChange={(e) => setGroupingLabel1(e.target.value)}
                    placeholder="Locations"
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-zinc-500 dark:text-zinc-400">
                    Group 2 Label
                  </span>
                  <input
                    value={groupingLabel2}
                    onChange={(e) => setGroupingLabel2(e.target.value)}
                    placeholder="Constellations"
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBrandingOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={brandingSaving}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {brandingSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {publishOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-foreground">Publish shared page</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Set or change password for public access.
            </p>
            <label className="mt-3 block text-xs">
              <span className="mb-1 block text-zinc-500 dark:text-zinc-400">Password</span>
              <input
                type="password"
                value={publishPassword}
                onChange={(e) => setPublishPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              />
            </label>

            {published && slug ? (
              <div className="mt-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Shareable link</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
                    https://starmap.lol/directory/{slug}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      const url = `https://starmap.lol/directory/${slug}`
                      await navigator.clipboard.writeText(url)
                      showToast('Link copied.', 'success')
                    }}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {published ? (
                <button
                  type="button"
                  disabled={publishSaving}
                  onClick={() => void unpublishDirectory()}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:text-red-400"
                >
                  Unpublish
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Close
              </button>
              <button
                type="button"
                disabled={publishSaving}
                onClick={() => void publishDirectory()}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {publishSaving ? 'Saving...' : published ? 'Change Password' : 'Confirm Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

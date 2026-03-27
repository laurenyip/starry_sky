'use client'

import Image from 'next/image'

export function NodeDetailPanel(props: {
  open: boolean
  node: any | null
  onClose: () => void

  // Header + avatar
  avatarPickerActive: boolean
  setAvatarPickerActive: (v: boolean) => void
  avatarUploading: boolean
  uploadNodePhoto: (file: File) => void
  panelName: string
  setPanelName: (v: string) => void
  personDisplayInitial: (name: string) => string
  panelRelationTags: string[]
  relationTagPillClass: (tag: string) => string

  // Photo strip + lightbox
  panelPhotos: any[]
  setPhotoLightbox: (p: any | null) => void
  addPhotoInputRef: React.RefObject<HTMLInputElement | null>

  // Body
  children: React.ReactNode

  // Footer
  panelSaveState: 'idle' | 'saved' | 'error'
  panelErr: string | null
  panelSaving: boolean
  onSave?: () => void
  saveLabel?: string
  canDelete: boolean
  onDelete: () => void
}) {
  const {
    open,
    node,
    onClose,
    avatarPickerActive,
    setAvatarPickerActive,
    avatarUploading,
    uploadNodePhoto,
    panelName,
    setPanelName,
    personDisplayInitial,
    panelRelationTags,
    relationTagPillClass,
    panelPhotos,
    setPhotoLightbox,
    addPhotoInputRef,
    children,
    panelSaveState,
    panelErr,
    panelSaving,
    onSave,
    saveLabel,
    canDelete,
    onDelete,
  } = props

  if (!open || !node) return null

  return (
    <aside className="fixed top-16 right-0 bottom-0 z-30 flex w-72 sm:w-80 flex-col border-l border-zinc-200 bg-background shadow-2xl dark:border-zinc-800">
      <div className="border-b p-3 dark:border-zinc-800">
        <div className="flex justify-end">
          <button
            type="button"
            className="text-2xl leading-none text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-1 flex flex-col items-center gap-2 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <div
              className={`group relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-zinc-100 transition-shadow dark:bg-zinc-800 ${
                avatarPickerActive
                  ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-background'
                  : ''
              }`}
            >
              {node.avatar_url ? (
                <Image
                  src={node.avatar_url}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-bold text-zinc-700 dark:text-zinc-200">
                  {personDisplayInitial(panelName || node.name)}
                </span>
              )}
              {avatarUploading ? (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
                  aria-busy
                >
                  <span
                    className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent dark:border-zinc-500"
                    role="status"
                  />
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.6}
                    stroke="currentColor"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574v6.176A2.25 2.25 0 004.5 18h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                    />
                  </svg>
                </div>
              )}
              <label className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-foreground text-background shadow-md transition hover:opacity-90">
                <span className="sr-only">Upload photo</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574v6.176A2.25 2.25 0 004.5 18h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                  />
                </svg>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={avatarUploading}
                  onClick={() => setAvatarPickerActive(true)}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) uploadNodePhoto(f)
                    else setAvatarPickerActive(false)
                  }}
                />
              </label>
            </div>
          </div>
          <div className="w-full flex-1 text-center sm:text-left">
            <textarea
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
              aria-label="Name"
              rows={2}
              className="mt-0.5 w-full resize-none border-b border-gray-300 bg-transparent px-1 py-0.5 text-base font-semibold text-foreground outline-none focus:border-blue-400 whitespace-normal break-words"
            />
            {panelRelationTags.length ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {panelRelationTags.map((t) => (
                  <span key={t} className={relationTagPillClass(t)}>
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
                No relationship tags
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto py-1">
          {panelPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
              onClick={() => setPhotoLightbox(photo)}
            >
              <Image
                src={photo.url}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
                unoptimized
              />
              {photo.is_primary ? (
                <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">
                  Main
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
            disabled={avatarUploading}
            onClick={() => addPhotoInputRef.current?.click()}
          >
            {avatarUploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent dark:border-zinc-500" />
            ) : (
              '+ Add Photo'
            )}
          </button>
          <input
            ref={addPhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) uploadNodePhoto(f)
            }}
          />
        </div>
        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">{children}</div>

      <div className="border-t p-3 dark:border-zinc-800 space-y-2">
        {panelSaveState === 'saved' ? (
          <p className="text-xs text-zinc-500 transition-opacity duration-300">
            Saved ✓
          </p>
        ) : null}
        {panelSaveState === 'error' ? (
          <p className="text-xs text-red-600">Failed to save</p>
        ) : null}
        {panelErr ? (
          <p className="text-sm text-red-600" role="alert">
            {panelErr}
          </p>
        ) : null}
        {onSave ? (
          <button
            type="button"
            disabled={panelSaving}
            className="w-full rounded-md bg-foreground py-1.5 text-sm text-background disabled:opacity-60"
            onClick={onSave}
          >
            {panelSaving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/80 border-t-transparent" />
                Saving...
              </span>
            ) : (
              saveLabel ?? 'Save'
            )}
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={panelSaving}
            className="w-full rounded-md border border-red-200 py-1 text-sm text-red-700 dark:border-red-900 disabled:opacity-40"
            onClick={onDelete}
          >
            Delete person
          </button>
        ) : null}
      </div>
    </aside>
  )
}


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

  /** Optional; gallery may live in the scroll body instead. */
  photoGallery?: React.ReactNode

  // Body
  children: React.ReactNode

  /** Inline save feedback below name (not the footer button state). */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onPanelNameBlur?: () => void

  // Footer
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
    photoGallery,
    children,
    saveStatus,
    onPanelNameBlur,
    panelErr,
    panelSaving,
    onSave,
    saveLabel,
    canDelete,
    onDelete,
  } = props

  if (!open || !node) return null

  return (
    <aside
      className="fixed top-16 right-0 bottom-0 z-20 flex w-72 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm [&_input]:text-base [&_select]:text-base [&_textarea]:text-base">
        <div className="flex justify-end">
          <button
            type="button"
            className="text-xl leading-none text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-1 flex flex-row items-start gap-3">
          <div className="relative shrink-0">
            <div
              className={`group relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gray-100 transition-shadow dark:bg-gray-800 ${
                avatarPickerActive
                  ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                  : ''
              }`}
            >
              {node.avatar_url ? (
                <Image
                  src={node.avatar_url}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  {personDisplayInitial(panelName || node.name)}
                </span>
              )}
              {avatarUploading ? (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-gray-900/70"
                  aria-busy
                >
                  <span
                    className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent dark:border-gray-500"
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
              <label className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-gray-200 bg-gray-900 text-white shadow-md transition hover:opacity-90 dark:border-gray-200 dark:bg-white dark:text-black">
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
                  accept="image/*"
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
          <div className="min-w-0 flex-1 text-left">
            <textarea
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
              onBlur={() => onPanelNameBlur?.()}
              aria-label="Name"
              rows={2}
              className="mt-0.5 w-full resize-none border-b border-gray-300 bg-transparent px-1 py-0.5 text-base font-semibold text-gray-900 outline-none focus:border-blue-400 whitespace-normal break-words dark:text-white"
            />
            {saveStatus !== 'idle' ? (
              <p
                className={`mt-1 min-h-[1em] text-sm transition-opacity duration-200 ${
                  saveStatus === 'saving'
                    ? 'text-gray-400 dark:text-gray-500'
                    : saveStatus === 'saved'
                      ? 'text-green-500 dark:text-green-400'
                      : saveStatus === 'error'
                        ? 'text-red-400 dark:text-red-400'
                        : 'opacity-0'
                }`}
                aria-live="polite"
              >
                {saveStatus === 'saving'
                  ? 'Saving...'
                  : saveStatus === 'saved'
                    ? 'Saved ✓'
                    : saveStatus === 'error'
                      ? 'Failed to save'
                      : ''}
              </p>
            ) : null}
            {panelRelationTags.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {panelRelationTags.map((t) => (
                  <span key={t} className={relationTagPillClass(t)}>
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs uppercase tracking-widest text-gray-400">
                No relationship tags
              </p>
            )}
          </div>
        </div>
        {photoGallery ? <div className="mt-3">{photoGallery}</div> : null}

        <div className="mt-3 space-y-3">{children}</div>
      </div>

      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 pt-2 dark:border-gray-800 dark:bg-gray-900">
        {panelErr ? (
          <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {panelErr}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {onSave ? (
            <button
              type="button"
              disabled={panelSaving}
              className="w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
              onClick={onSave}
            >
              {panelSaving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent dark:border-gray-900/80" />
                  Saving...
                </span>
              ) : (
                saveLabel ?? 'Save changes'
              )}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={panelSaving}
              className="w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:hover:bg-red-950/30"
              onClick={onDelete}
            >
              Delete person
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

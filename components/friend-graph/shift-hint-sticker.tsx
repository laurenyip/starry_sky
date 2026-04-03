'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'starmap_shift_hint_dismissed'

export function ShiftHintSticker({ visible }: { visible: boolean }) {
  const [hydrated, setHydrated] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      setDismissed(false)
    }
    setHydrated(true)
  }, [])

  const finishDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    setDismissed(true)
    setExiting(false)
  }, [])

  useEffect(() => {
    if (!exiting) return
    const id = window.setTimeout(finishDismiss, 200)
    return () => window.clearTimeout(id)
  }, [exiting, finishDismiss])

  if (!hydrated || dismissed || !visible) return null

  return (
    <div
      role="note"
      className={`pointer-events-auto absolute bottom-24 left-4 z-30 max-w-[200px] rotate-[-2deg] rounded-lg px-3 py-2 shadow-md transition-[opacity,transform] duration-200 ease-out ${
        exiting ? 'scale-[0.8] opacity-0' : 'scale-100 opacity-100'
      } bg-[#FEF08A] dark:bg-[#713F12]`}
    >
      <button
        type="button"
        aria-label="Dismiss hint"
        className="absolute right-1.5 top-1 cursor-pointer text-xs text-yellow-700 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-200"
        onClick={() => setExiting(true)}
      >
        ×
      </button>
      <p className="pr-5 text-xs leading-snug text-yellow-900 dark:text-yellow-200">
        ✦ Hold Shift and click multiple nodes to connect them or add them to a
        constellation or location
      </p>
    </div>
  )
}

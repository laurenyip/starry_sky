'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void) {
  const el = document.documentElement
  const obs = new MutationObserver(onStoreChange)
  obs.observe(el, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark')
}

function getServerSnapshot() {
  return false
}

/**
 * Theme is applied via an inline script before hydration, so the DOM may
 * already have `dark` while SSR and the first client render must match
 * `getServerSnapshot()` (false). We gate on `mounted` until after hydration.
 */
export function useIsDark() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const synced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return mounted ? synced : false
}

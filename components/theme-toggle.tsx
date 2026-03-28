'use client'

import { useCallback, useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void) {
  const el = document.documentElement
  const observer = new MutationObserver(onStoreChange)
  observer.observe(el, {
    attributes: true,
    attributeFilter: ['class'],
  })
  window.addEventListener('storage', onStoreChange)
  return () => {
    observer.disconnect()
    window.removeEventListener('storage', onStoreChange)
  }
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark')
}

function getServerSnapshot() {
  return false
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const nextDark = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', nextDark)
    try {
      localStorage.setItem('theme', nextDark ? 'dark' : 'light')
    } catch {
      // ignore
    }
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="shrink-0 rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <span className="text-base leading-none" aria-hidden>
        {dark ? '☀' : '☽'}
      </span>
    </button>
  )
}

'use client'

import { useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'

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

export function useLandingIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Glass panel styles for landing cards (matches `html.dark` class from theme toggle). */
export function useLandingGlassStyle(): CSSProperties {
  const isDark = useLandingIsDark()
  return {
    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.85)',
    boxShadow: isDark ? '0 2px 20px rgba(0,0,0,0.25)' : '0 2px 20px rgba(0,0,0,0.06)',
  }
}

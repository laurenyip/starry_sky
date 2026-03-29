'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'

type Toast = {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

const ToastCtx = createContext<{
  showToast: (
    message: string,
    type: 'success' | 'error' | 'info',
    durationMs?: number
  ) => void
} | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info',
      durationMs: number = 4500
    ) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { id, message, type }])
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id))
      }, durationMs)
    },
    []
  )

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[200] flex max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
              t.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100'
                : t.type === 'info'
                  ? 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-200'
                  : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/90 dark:text-red-100'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

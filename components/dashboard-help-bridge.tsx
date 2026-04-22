'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

type DashboardHelpBridgeValue = {
  registerOpenHelp: (fn: (() => void) | null) => void
  requestOpenHelp: () => void
}

const DashboardHelpBridgeContext =
  createContext<DashboardHelpBridgeValue | null>(null)

export function DashboardHelpBridgeProvider({
  children,
}: {
  children: ReactNode
}) {
  const openerRef = useRef<(() => void) | null>(null)

  const registerOpenHelp = useCallback((fn: (() => void) | null) => {
    openerRef.current = fn
  }, [])

  const requestOpenHelp = useCallback(() => {
    openerRef.current?.()
  }, [])

  const value = useMemo(
    () => ({ registerOpenHelp, requestOpenHelp }),
    [registerOpenHelp, requestOpenHelp]
  )

  return (
    <DashboardHelpBridgeContext.Provider value={value}>
      {children}
    </DashboardHelpBridgeContext.Provider>
  )
}

export function useDashboardHelpBridge(): DashboardHelpBridgeValue | null {
  return useContext(DashboardHelpBridgeContext)
}

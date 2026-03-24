'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type SupabaseContextValue = {
  supabase: SupabaseClient
  session: Session | null
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createSupabaseBrowserClient())
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    void supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const value = useMemo(
    () => ({ supabase, session }),
    [supabase, session]
  )

  return (
    <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
  )
}

export function useSupabaseContext() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) {
    throw new Error('useSupabaseContext must be used within SupabaseProvider')
  }
  return ctx
}

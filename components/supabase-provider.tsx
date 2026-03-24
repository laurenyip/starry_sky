'use client'

import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type SupabaseContextValue = {
  supabase: SupabaseClient | null
  session: Session | null
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    if (!url || !key) {
      return
    }

    const client = createBrowserClient(url, key)
    setSupabase(client)

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    void client.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current)
    })

    return () => subscription.unsubscribe()
  }, [])

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

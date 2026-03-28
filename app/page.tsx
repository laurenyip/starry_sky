import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'
import SmartCTA from '@/components/smart-cta'

export default async function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (supabaseUrl && supabaseAnonKey) {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) redirect('/dashboard')
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Welcome
        </p>
        <div className="mt-2">
          <Logo textClassName="text-4xl tracking-tight sm:text-5xl" />
        </div>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Map the people in your life and how they&apos;re connected. Build your
          graph, add relationships, and share a read-only public profile so
          friends can explore it too.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SmartCTA label="Go to Dashboard" />
          <SmartCTA label="Go to Dashboard" />
        </div>

        <p className="mt-12 text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{' '}
          <SmartCTA
            label="Go to Dashboard"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          />
          .
        </p>
      </main>
    </div>
  )
}

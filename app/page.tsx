import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DemoGraph } from '@/components/DemoGraph'
import { Logo } from '@/components/Logo'
import { SocialProof } from '@/components/SocialProof'
import Link from 'next/link'

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

        <SocialProof />

        <section className="mt-12 flex w-full flex-col items-center gap-6 px-4 py-12">
          <p className="text-sm tracking-widest text-gray-400 uppercase">
            your world, mapped
          </p>
          <DemoGraph />
          <p className="max-w-sm text-center text-xs text-gray-500">
            Visualise your relationships, communities, and connections in one
            living map.
          </p>
        </section>

        <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Map the people in your life and how they&apos;re connected. Build your
          graph, add relationships, and share a read-only public profile so
          friends can explore it too.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-0 rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 14 14"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
              aria-hidden
            >
              <path d="M7 0 L8.2 5.8 L14 7 L8.2 8.2 L7 14 L5.8 8.2 L0 7 L5.8 5.8 Z" />
            </svg>
            <span>start now</span>
          </Link>

          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link
              href="/dashboard"
              className="text-gray-300 underline decoration-gray-400 underline-offset-2 transition-colors hover:text-gray-200"
            >
              Go to Dashboard
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}

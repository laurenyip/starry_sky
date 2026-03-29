import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DemoGraph } from '@/components/DemoGraph'
import { CassiopeiaConstellation } from '@/components/landing/cassiopeia-constellation'
import { LandingFeatureCards } from '@/components/landing/landing-feature-cards'
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        {/* SECTION 1 — Hero */}
        <section className="flex flex-col items-center text-center">
          <p className="text-sm tracking-widest uppercase text-gray-400 dark:text-gray-500">
            welcome to
          </p>
          <div className="mt-3">
            <Logo textClassName="text-5xl tracking-tight md:text-7xl" />
          </div>
          <CassiopeiaConstellation />
        </section>

        {/* Demo + tagline (repositioned) */}
        <section className="mt-16 flex w-full flex-col items-center gap-6 px-0 py-8 sm:py-10">
          <p className="text-sm tracking-widest text-gray-400 uppercase dark:text-gray-500">
            your world, mapped
          </p>
          <div className="w-full max-w-3xl">
            <DemoGraph />
          </div>
          <p className="max-w-md text-center text-xs text-gray-500 dark:text-gray-400">
            Visualise your relationships, communities, and connections in one
            living map.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-gray-600 underline decoration-gray-400 underline-offset-2 transition-colors hover:text-foreground dark:text-gray-300 dark:hover:text-white"
              >
                Sign in
              </Link>
              {' · '}
              <Link
                href="/dashboard"
                className="text-gray-600 underline decoration-gray-400 underline-offset-2 transition-colors hover:text-foreground dark:text-gray-300 dark:hover:text-white"
              >
                Dashboard
              </Link>
            </p>
          </div>
        </section>

        {/* SECTION 2 — Feature cards */}
        <div className="mt-8">
          <LandingFeatureCards />
        </div>

        {/* SECTION 3 — Social proof */}
        <SocialProof />

        {/* SECTION 4 — Why */}
        <section className="mx-auto mt-16 max-w-xl px-2 text-center">
          <p className="text-xs tracking-widest text-gray-400 uppercase dark:text-gray-500">
            why starmap exists
          </p>
          <div className="mt-6 text-sm leading-relaxed text-gray-500 text-center dark:text-gray-400">
            <p className="mb-4">
              I made Starmap because I wanted to be a better friend.
            </p>
            <p className="mb-4">
              I wanted to remember the small things — what someone&apos;s allergic
              to, their favourite film, what we talked about last time, our plans
              we keep saying we&apos;ll make. I wanted to see how the people in my
              life connect to each other, and hold onto the moments that matter.
            </p>
            <p>
              This is a map of the people who make up your world.
            </p>
          </div>
        </section>

        {/* SECTION 5 — Contact */}
        <p className="mx-auto mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          questions or feedback →{' '}
          <a
            href="mailto:support@starmap.lol"
            className="text-gray-400 underline underline-offset-4 transition-colors hover:text-gray-200"
          >
            support@starmap.lol
          </a>
        </p>

        {/* Footer */}
        <p className="py-8 text-center text-xs text-gray-500">
          Made by{' '}
          <a
            href="https://laurenyip.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 underline underline-offset-4 transition-colors hover:text-gray-200"
          >
            Lauren Yip
          </a>
        </p>
      </main>
    </div>
  )
}

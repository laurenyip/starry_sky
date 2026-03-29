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
    <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        {/* SECTION 1 — Hero */}
        <section className="flex flex-col items-center rounded-2xl bg-gray-50 px-4 py-16 text-center dark:bg-[#080B14] sm:px-6">
          <p className="text-sm tracking-widest uppercase text-gray-400 dark:text-gray-500">
            welcome to
          </p>
          <div className="mt-3">
            <Logo textClassName="text-5xl tracking-tight md:text-7xl" />
          </div>
          <CassiopeiaConstellation />
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 dark:bg-foreground dark:text-background dark:hover:opacity-90"
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-gray-700 underline decoration-gray-400 underline-offset-2 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Sign in
              </Link>
              {' · '}
              <Link
                href="/dashboard"
                className="text-gray-700 underline decoration-gray-400 underline-offset-2 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Dashboard
              </Link>
            </p>
          </div>
          <p className="mt-2 text-sm tracking-wide text-gray-400 dark:text-gray-500">
            Your world, mapped
          </p>
        </section>

        <hr className="my-0 border-gray-100 dark:border-gray-800 max-w-xs mx-auto" />

        {/* Demo graph */}
        <section className="flex w-full min-w-0 flex-col items-center py-16">
          <div className="w-full min-w-0 max-w-5xl">
            <DemoGraph />
          </div>
        </section>

        <hr className="my-0 border-gray-100 dark:border-gray-800 max-w-xs mx-auto" />

        {/* Feature cards */}
        <div className="py-16">
          <LandingFeatureCards />
        </div>

        <hr className="my-0 border-gray-100 dark:border-gray-800 max-w-xs mx-auto" />

        {/* Social proof */}
        <SocialProof />

        <hr className="my-0 border-gray-100 dark:border-gray-800 max-w-xs mx-auto" />

        {/* Why */}
        <section className="mx-auto max-w-xl px-2 py-16 text-center">
          <p className="text-xs tracking-widest text-gray-400 uppercase dark:text-gray-500">
            why starmap exists
          </p>
          <div className="mt-6 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            <p className="mb-4">
              I made Starmap because I wanted to be a better friend.
            </p>
            <p className="mb-4">
              I wanted to remember the small things — what someone&apos;s allergic
              to, their favourite film, what we talked about last time, our plans
              we keep saying we&apos;ll make. I wanted to see how the people in my
              life connect to each other, and hold onto the moments that matter.
            </p>
            <p>This is a map of the people who make up your world.</p>
          </div>
        </section>

        <hr className="my-0 border-gray-100 dark:border-gray-800 max-w-xs mx-auto" />

        {/* Contact */}
        <section className="mx-auto max-w-xl px-2 py-16 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            questions or feedback →{' '}
            <a
              href="mailto:support@starmap.lol"
              className="text-gray-600 underline underline-offset-4 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              support@starmap.lol
            </a>
          </p>
        </section>

        {/* Footer */}
        <p className="pb-8 text-center text-xs text-gray-500 dark:text-gray-500">
          Made by{' '}
          <a
            href="https://laurenyip.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-700 underline underline-offset-4 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Lauren Yip
          </a>
        </p>
      </div>
    </div>
  )
}

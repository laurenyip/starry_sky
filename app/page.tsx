import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DemoGraph } from '@/components/DemoGraph'
import { FigmaDesktop47_40 } from '@/components/landing/figma-desktop-47-40'
import { FIGMA_LANDING } from '@/lib/figma-landing-constants'
import { LandingFeatureCards } from '@/components/landing/landing-feature-cards'
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

  const heroH = `calc(100dvh - ${FIGMA_LANDING.navHeight}px)`

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background max-w-[100vw]">
      {/* Hero viewport: no scroll; body scales inside — Figma file xKwWnYVpMhOklOw8B0KG0n node 47:40 */}
      <div
        className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden"
        style={{ height: heroH, maxHeight: heroH }}
      >
        <FigmaDesktop47_40 />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-4 pb-16 pt-0 sm:px-6">
        {/* Demo graph */}
        <section className="flex w-full min-w-0 flex-col items-center py-16">
          <div className="w-full min-w-0 max-w-5xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <DemoGraph />
          </div>
        </section>

        <hr className="mx-auto my-0 max-w-xs border-gray-200" />

        {/* Feature cards */}
        <div className="py-16">
          <LandingFeatureCards />
        </div>

        <hr className="mx-auto my-0 max-w-xs border-gray-200" />

        {/* Social proof */}
        <SocialProof />

        <hr className="mx-auto my-0 max-w-xs border-gray-200" />

        {/* Why */}
        <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <p className="text-xs tracking-widest text-gray-400 uppercase">
            why starmap exists
          </p>
          <div className="mt-6 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            <p className="mb-4">
              I made Starmap because I wanted to be a better friend.
            </p>
            <p className="mb-4">
              Before this, I had a 2k word Notion doc with 70 people and journal-entry style notes on all of them. Someone joked that I had version-control on all my friends. I decided to write about everyone because I felt that I had no time and I wasn't sure who my real friends were. First I wrote to discover how I felt, and then I realized it was a useful tool to remember the small things — what someone&apos;s allergic
              to, their favourite films, what we talked about, our plans
              we keep saying we&apos;ll make.
            </p>
            <p>This is my solution: a personal relationship management tool that organizes people by how they fit in your life and what they mean to you.</p>
          </div>
        </section>

        <hr className="mx-auto my-0 max-w-xs border-gray-200" />

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

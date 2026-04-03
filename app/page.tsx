import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { FigmaDesktop47_40 } from '@/components/landing/figma-desktop-47-40'
import { LandingFeatureCards } from '@/components/landing/landing-feature-cards'
import { SocialProof } from '@/components/SocialProof'

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
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-white max-w-[100vw] dark:bg-[#0a0a0f]">

      {/* Hero (Figma 64:9) */}
      <FigmaDesktop47_40 />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-4 pb-16 pt-0 sm:px-6">

        {/* "How it works" label (Figma node 89:573–89:574) */}
        <p
          className="mb-10 mt-16 text-center text-[12px] font-normal uppercase tracking-[1.2px] text-[#99a1af] dark:text-gray-500"
          data-node-id="89:574"
        >
          How it works
        </p>

        {/* Feature cards — Remember everything · Create constellations · Connect anyone */}
        <LandingFeatureCards />

        <hr className="mx-auto my-0 mt-16 max-w-xs border-[#e5e7eb] dark:border-white/10" />

        {/* Social proof (Figma 64:261) */}
        <SocialProof />

        <hr className="mx-auto my-0 max-w-xs border-[#e5e7eb] dark:border-white/10" />

        {/* Why starmap exists (Figma 64:465–64:479) */}
        <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6" data-node-id="64:466">
          <p
            className="text-[12px] uppercase tracking-[1.2px] text-[#99a1af] dark:text-gray-500"
            data-node-id="64:470"
          >
            why starmap exists
          </p>
          <div className="mt-6 text-sm leading-relaxed text-gray-700 dark:text-gray-400" data-node-id="64:473">
            <p className="mb-4 text-center" data-node-id="64:475">
              I made Starmap because I wanted to be a better friend.
            </p>
            <p className="mb-4 text-center" data-node-id="64:477">
              Before this, I had a 2k word Notion doc with 70 people and
              journal-entry style notes on all of them. Someone joked that I
              had version-control on all my friends. I decided to write about
              everyone because I felt that I had no time and I wasn&apos;t
              sure who my real friends were. First I wrote to discover how I
              felt, and then I realized it was a useful tool to remember the
              small things — what someone&apos;s allergic to, their favourite
              films, what we talked about, our plans we keep saying we&apos;ll
              make.
            </p>
            <p className="text-center" data-node-id="64:479">
              This is my solution: a personal relationship management tool
              that organizes people by how they fit in your life and what they
              mean to you.
            </p>
          </div>
        </section>

        <hr className="mx-auto my-0 max-w-xs border-[#e5e7eb] dark:border-white/10" />

        {/* Contact (Figma 64:480–64:482) */}
        <section className="mx-auto max-w-xl px-2 py-16 text-center" data-node-id="64:481">
          <p className="text-sm text-gray-700 dark:text-gray-400" data-node-id="64:482">
            questions or feedback →{' '}
            <a
              href="mailto:support@starmap.lol"
              className="underline underline-offset-4 transition-colors hover:text-[#1e2939] dark:text-gray-400 dark:hover:text-gray-200"
            >
              support@starmap.lol
            </a>
          </p>
        </section>

        {/* Footer (Figma 64:483–64:484) */}
        <p className="pb-8 text-center text-xs text-[#6a7282] dark:text-gray-500" data-node-id="64:484">
          Made by{' '}
          <a
            href="https://laurenyip.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 underline underline-offset-4 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-gray-200"
          >
            Lauren Yip
          </a>
        </p>
      </div>
    </div>
  )
}

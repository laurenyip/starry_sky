'use client'

/**
 * Figma node 64:3 → Section 64:9 — hero section.
 * Centered layout: heading + ✦ icon, constellation SVG, CTA pill button, sign-in link.
 * Design tokens: #4a5565 (River Bed) as primary; Sohne Kräftig heading font.
 */
import * as Assets from '@/lib/figma-landing-assets'
import Link from 'next/link'

export function FigmaDesktop47_40() {
  return (
    <section
      className="w-full bg-white py-16 dark:bg-[#0a0a0f] md:py-24"
      data-node-id="64:9"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6">
        {/* Heading + ✦ icon (nodes 64:23 / 64:26 / 64:34) */}
        <div className="flex items-start gap-1.5" data-node-id="64:23">
          <h1
            className="text-center font-semibold not-italic leading-none text-black dark:text-white"
            style={{
              fontFamily: 'Sohne, sans-serif',
              fontSize: 'clamp(2rem, 5.5vw, 4.5rem)',
              letterSpacing: '-0.025em',
            }}
            data-node-id="64:26"
          >
            map your relationships
          </h1>
          <div
            className="relative mt-1 h-5 w-5 shrink-0"
            aria-hidden
            data-node-id="64:36"
          >
            <img
              src={Assets.imgLogoPlus}
              alt=""
              className="block size-full object-contain"
            />
          </div>
        </div>

        {/* Constellation SVG (node 85:439) */}
        <div
          className="mt-4 h-[120px] w-[220px] shrink-0"
          data-node-id="85:439"
        >
          <img
            src={Assets.imgHeroConstellation}
            alt=""
            className="figma-constellation-asset block size-full object-contain"
          />
        </div>

        {/* CTA + sign-in row (nodes 64:80 / 64:81) */}
        <div
          className="mt-10 flex flex-col items-center gap-3"
          data-node-id="64:81"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
            data-node-id="64:83"
          >
            <img
              src={Assets.imgStar2}
              alt=""
              className="h-4 w-4 shrink-0"
              aria-hidden
              data-node-id="64:87"
            />
            start now
          </Link>

          <p
            className="text-sm text-gray-600 dark:text-gray-400"
            data-node-id="64:95"
          >
            Already have an account?{' '}
            <Link
              href="/login"
              className="underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

'use client'

/**
 * Figma node 64:3 → Section 64:9 — hero section.
 * Centered layout: heading + ✦ icon, constellation SVG, CTA pill button, sign-in link.
 * Design tokens: #4a5565 (River Bed) as primary; Sohne Kräftig heading font.
 */
import { StarIcon } from '@/components/star-icon'
import Link from 'next/link'

export function FigmaDesktop47_40() {
  return (
    <section
      className="relative z-10 w-full py-16 md:py-24"
      data-node-id="64:9"
    >
      <div className="relative z-10 mx-auto flex min-w-0 max-w-4xl flex-col items-center px-4 sm:px-6">
        {/* Heading + ✦ icon (nodes 64:23 / 64:26 / 64:34) */}
        <div
          className="flex min-w-0 max-w-full flex-wrap items-start justify-center gap-x-1.5 gap-y-1"
          data-node-id="64:23"
        >
          <h1
            className="min-w-0 max-w-full text-center font-medium not-italic leading-[1.05] text-gray-900 dark:text-white"
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
            className="relative mt-1 h-5 w-5 shrink-0 text-gray-800 dark:text-white"
            aria-hidden
            data-node-id="64:36"
          >
            <StarIcon className="block h-5 w-5" />
          </div>
        </div>

        {/* Constellation SVG — opaque nodes, inner highlights, per-node twinkle, shared line breathe */}
        <svg
          viewBox="0 0 220 120"
          className="mt-4 h-auto w-full max-w-[min(100%,240px)] shrink-0 [aspect-ratio:220/120] sm:max-w-[220px]"
          aria-hidden
          data-node-id="85:439"
        >
          <defs>
            <filter id="landing-hero-node-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="landing-hero-node-glow-dark" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <line x1="42" y1="30" x2="110" y2="58" className="hero-constellation-line-main constellation-line-breathe" strokeDasharray="4 3" />
          <line x1="170" y1="24" x2="110" y2="58" className="hero-constellation-line-main constellation-line-breathe" strokeDasharray="4 3" />
          <line x1="110" y1="58" x2="70" y2="98" className="hero-constellation-line-main constellation-line-breathe" strokeDasharray="4 3" />
          <line x1="110" y1="58" x2="158" y2="94" className="hero-constellation-line-main constellation-line-breathe" strokeDasharray="4 3" />
          <line x1="42" y1="30" x2="112" y2="14" className="hero-constellation-line-sub constellation-line-breathe" strokeDasharray="3 4" />
          <line x1="170" y1="24" x2="112" y2="14" className="hero-constellation-line-sub constellation-line-breathe" strokeDasharray="3 4" />
          <line x1="24" y1="76" x2="42" y2="30" className="hero-constellation-line-faint constellation-line-breathe" strokeDasharray="3 5" />

          <circle cx="200" cy="45" r="2.4" className="fill-indigo-500 dark:fill-indigo-400" />
          <circle cx="188" cy="108" r="1.8" className="fill-violet-500 dark:fill-violet-400" />
          <circle cx="10" cy="40" r="1.8" className="fill-indigo-500 dark:fill-indigo-400" />
          <circle cx="140" cy="108" r="2.16" className="fill-violet-500 dark:fill-violet-400" />

          {(
            [
              { cx: 110, cy: 58, r: 7.2, fill: '#7c3aed', darkFill: '#c4b5fd', tw: 'landing-node-twinkle-a' },
              { cx: 42, cy: 30, r: 5.4, fill: '#8b5cf6', darkFill: '#ddd6fe', tw: 'landing-node-twinkle-b' },
              { cx: 170, cy: 24, r: 4.8, fill: '#6366f1', darkFill: '#e0e7ff', tw: 'landing-node-twinkle-c' },
              { cx: 112, cy: 14, r: 3.6, fill: '#a78bfa', darkFill: '#ede9fe', tw: 'landing-node-twinkle-d' },
              { cx: 70, cy: 98, r: 4.8, fill: '#8b5cf6', darkFill: '#ddd6fe', tw: 'landing-node-twinkle-e' },
              { cx: 158, cy: 94, r: 4.2, fill: '#6366f1', darkFill: '#e0e7ff', tw: 'landing-node-twinkle-a' },
              { cx: 24, cy: 76, r: 3.6, fill: '#a78bfa', darkFill: '#ede9fe', tw: 'landing-node-twinkle-b' },
            ] as const
          ).map((n, i) => (
            <g key={i} transform={`translate(${n.cx} ${n.cy})`}>
              <g className={n.tw}>
                <circle
                  r={n.r}
                  fill={n.fill}
                  className="dark:hidden"
                  filter="url(#landing-hero-node-glow)"
                />
                <circle
                  r={n.r}
                  fill={n.darkFill}
                  className="hidden dark:block"
                  filter="url(#landing-hero-node-glow-dark)"
                />
                <circle r={n.r * 0.3} fill="rgba(255,255,255,0.3)" />
              </g>
            </g>
          ))}
        </svg>

        {/* CTA + sign-in row (nodes 64:80 / 64:81) */}
        <div
          className="mt-10 flex flex-col items-center gap-3"
          data-node-id="64:81"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-base font-medium text-white shadow-lg transition-colors hover:opacity-90 dark:bg-white dark:text-gray-900 sm:px-6"
            data-node-id="64:83"
          >
            <span className="inline-flex shrink-0" data-node-id="64:87" aria-hidden>
              <StarIcon className="h-4 w-4 text-white dark:text-gray-900" />
            </span>
            start now
          </Link>

          <p
            className="max-w-[min(100%,22rem)] text-center text-sm text-gray-700 dark:text-white/95"
            data-node-id="64:95"
          >
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-gray-900 underline underline-offset-2 dark:text-white dark:hover:text-white"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

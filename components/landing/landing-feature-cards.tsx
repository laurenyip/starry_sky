'use client'

import { useLandingGlassStyle } from '@/components/landing/use-landing-glass-style'
import { imgCalendarAlt } from '@/lib/figma-landing-assets'

export function LandingFeatureCards() {
  const glass = useLandingGlassStyle()

  return (
    <section className="mx-auto w-full min-w-0 max-w-5xl px-3 sm:px-0" aria-labelledby="features-heading">
      <h2 id="features-heading" className="sr-only">
        Features
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Card 1 — Node profiles */}
        <article className="flex flex-col overflow-hidden rounded-2xl" style={glass}>
          <div className="border-b border-black/[0.06] p-4 dark:border-white/10">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Remember everything
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-white">
              Every person gets a profile. Store birthdays, allergies, favourite things,
              how you met, upcoming plans, and how you feel about them — all in one place.
            </p>
          </div>
          <div className="flex flex-1 flex-col bg-transparent p-4">
            <div className="rounded-xl p-3" style={glass} data-node-id="87:532">
              <div className="flex gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: 'linear-gradient(180deg, #8e51ff 0%, #acffc1 100%)' }}
                  aria-hidden
                >
                  ME
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Mayak Egg
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-full border border-transparent bg-[rgba(0,188,125,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#007a55] dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-white">
                      Close Friend
                    </span>
                    <span className="rounded-full border border-transparent bg-[rgba(142,81,255,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#31009f] dark:border-violet-400/35 dark:bg-violet-500/20 dark:text-white">
                      Colleague
                    </span>
                  </div>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-300">
                    LOCATION
                  </dt>
                  <dd className="text-gray-600 dark:text-white">Vancouver, BC</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-300">
                    THINGS TO REMEMBER
                  </dt>
                  <dd className="text-xs leading-relaxed text-gray-500 dark:text-white">
                    A little salty but a great egg snack, especially with rice.
                    Loves hiking and is always late.
                  </dd>
                </div>
              </dl>
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-300">
                  CUSTOM ATTRIBUTES
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-600 dark:text-white">
                    Birthday: 2002-09-21
                  </span>
                  <img
                    src={imgCalendarAlt}
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 opacity-60 dark:opacity-90 dark:invert"
                    aria-hidden
                  />
                </div>
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-300">PHOTOS</p>
            </div>
          </div>
        </article>

        {/* Card 2 — Communities */}
        <article className="flex flex-col overflow-hidden rounded-2xl" style={glass}>
          <div className="border-b border-black/[0.06] p-4 dark:border-white/10">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Create constellations
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-white">
              Sort people into any categories you want. Click any group to watch its
              constellation light up across your graph.
            </p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center bg-transparent px-3 py-6">
            <svg viewBox="0 0 220 120" className="h-auto w-full max-w-[220px]" aria-hidden>
              <defs>
                <filter id="glow-purple-feature" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glow-purple-feature-dark" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="165" cy="28" r="6" className="fill-gray-300/45 dark:fill-gray-500/40" />
              <circle cx="188" cy="72" r="6" className="fill-gray-300/45 dark:fill-gray-500/40" />
              <circle cx="175" cy="100" r="6" className="fill-gray-300/45 dark:fill-gray-500/40" />
              <circle cx="148" cy="48" r="5" className="fill-gray-300/40 dark:fill-gray-500/35" />
              <line
                x1="52"
                y1="58"
                x2="88"
                y2="82"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="feature-mini-constellation-line constellation-line-breathe"
              />
              <line
                x1="88"
                y1="82"
                x2="108"
                y2="42"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="feature-mini-constellation-line constellation-line-breathe"
              />
              <line
                x1="108"
                y1="42"
                x2="52"
                y2="58"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="feature-mini-constellation-line constellation-line-breathe"
              />
              <circle
                cx="52"
                cy="58"
                r="11"
                fill="none"
                strokeWidth="1"
                className="feature-mini-glow-ring constellation-line-breathe"
              />
              <circle
                cx="88"
                cy="82"
                r="11"
                fill="none"
                strokeWidth="1"
                className="feature-mini-glow-ring constellation-line-breathe"
                style={{ animationDelay: '0.2s' }}
              />
              <circle
                cx="108"
                cy="42"
                r="11"
                fill="none"
                strokeWidth="1"
                className="feature-mini-glow-ring constellation-line-breathe"
                style={{ animationDelay: '0.4s' }}
              />
              {(
                [
                  { r: 7, fill: '#a78bfa', darkFill: '#c4b5fd', tw: 'landing-node-twinkle-a' },
                  { r: 7, fill: '#8b5cf6', darkFill: '#ddd6fe', tw: 'landing-node-twinkle-b' },
                  { r: 7, fill: '#a78bfa', darkFill: '#c4b5fd', tw: 'landing-node-twinkle-c' },
                ] as const
              ).map((n, i) => {
                const pos = [
                  { cx: 52, cy: 58 },
                  { cx: 88, cy: 82 },
                  { cx: 108, cy: 42 },
                ][i]!
                return (
                  <g key={i} transform={`translate(${pos.cx} ${pos.cy})`}>
                    <g className={n.tw}>
                      <circle
                        r={n.r}
                        fill={n.fill}
                        className="dark:hidden"
                        filter="url(#glow-purple-feature)"
                      />
                      <circle
                        r={n.r}
                        fill={n.darkFill}
                        className="hidden dark:block"
                        filter="url(#glow-purple-feature-dark)"
                      />
                      <circle r={n.r * 0.3} fill="rgba(255,255,255,0.3)" />
                    </g>
                  </g>
                )
              })}
            </svg>
            <div
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-gray-900 dark:text-white"
              style={glass}
            >
              <span className="text-violet-600 dark:text-violet-300" aria-hidden>
                ●
              </span>
              Close Friends
            </div>
          </div>
        </article>

        {/* Card 3 — Edges */}
        <article className="flex flex-col overflow-hidden rounded-2xl" style={glass}>
          <div className="border-b border-black/[0.06] p-4 dark:border-white/10">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Connect anyone
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-white">
              Draw a line between any two people to represent any kind of
              relationship. Friends, rivals, family — you define it.
            </p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-transparent px-3 py-8">
            <svg viewBox="0 0 240 72" className="h-auto w-full max-w-[240px]" aria-hidden>
              <line
                x1="28"
                y1="36"
                x2="212"
                y2="36"
                strokeDasharray="184"
                strokeLinecap="round"
                className="feature-card-edge-line landing-edge-line constellation-line-breathe"
              />
              <circle
                cx="28"
                cy="36"
                r="10.8"
                fill="#34d399"
                className="drop-shadow-[0_0_10px_rgba(52,211,153,0.65)] dark:drop-shadow-[0_0_16px_rgba(52,211,153,0.75)]"
              />
              <circle
                cx="212"
                cy="36"
                r="10.8"
                fill="#a78bfa"
                className="drop-shadow-[0_0_10px_rgba(167,139,250,0.65)] dark:drop-shadow-[0_0_16px_rgba(196,181,253,0.75)]"
              />
              <text x="28" y="58" textAnchor="middle" className="feature-card-edge-label text-[10px]">
                Jordan
              </text>
              <text x="212" y="58" textAnchor="middle" className="feature-card-edge-label text-[10px]">
                Priya
              </text>
              <g>
                <rect
                  x="92"
                  y="22"
                  width="72"
                  height="18"
                  rx="9"
                  className="feature-card-edge-pill"
                  strokeWidth="1"
                />
                <text
                  x="128"
                  y="34"
                  textAnchor="middle"
                  className="feature-card-edge-pill-text text-[9px] font-medium"
                >
                  Close Friend
                </text>
              </g>
            </svg>
            <button
              type="button"
              tabIndex={-1}
              className="landing-ghost-pulse pointer-events-none rounded-lg border border-dashed border-zinc-300/80 bg-transparent px-3 py-1.5 text-[11px] text-gray-600 dark:border-white/35 dark:text-white"
            >
              + Add connection
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}

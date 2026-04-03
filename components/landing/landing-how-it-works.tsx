'use client'

/**
 * Figma node 64:3 — "How it works" section.
 * Left column: person detail card (node 87:532).
 * Right column: "CREATE CONSTELLATIONS" heading + description + constellation SVG + badge (nodes 87:504–87:525).
 * Design tokens: #4a5565 River Bed primary, #6a7282 Pale Sky muted, #1e2939 Mirage dark.
 */
import * as Assets from '@/lib/figma-landing-assets'

export function LandingHowItWorks() {
  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 sm:px-6"
      aria-labelledby="how-it-works-heading"
    >
      <h2 id="how-it-works-heading" className="sr-only">
        How it works
      </h2>

      <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-2 md:gap-16">

        {/* ── Left: person detail card (node 87:532) ── */}
        <div
          className="rounded-xl border border-[rgba(212,212,216,0.8)] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900/60"
          data-node-id="87:532"
        >
          {/* Header: avatar + name + tags */}
          <div className="flex gap-3" data-node-id="87:534">
            {/* Gradient avatar (node 87:535) */}
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(180deg, #8e51ff 0%, #acffc1 100%)' }}
              aria-hidden
              data-node-id="87:535"
            >
              ME
            </div>

            <div className="min-w-0 flex-1" data-node-id="87:537">
              {/* Name */}
              <p
                className="text-sm font-medium text-[#101828] dark:text-white"
                data-node-id="87:539"
              >
                Mayak Egg
              </p>
              {/* Relationship tags (node 87:540) */}
              <div className="mt-1.5 flex flex-wrap gap-1" data-node-id="87:540">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: 'rgba(0,188,125,0.15)', color: '#007a55' }}
                  data-node-id="87:541"
                >
                  Close Friend
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: 'rgba(142,81,255,0.15)', color: '#31009f' }}
                  data-node-id="87:543"
                >
                  Colleague
                </span>
              </div>
            </div>
          </div>

          {/* Descriptions (node 87:545) */}
          <dl className="mt-3 space-y-1.5 text-[11px]" data-node-id="87:545">
            <div className="flex gap-2" data-node-id="87:546">
              <dt className="w-24 shrink-0 text-[#6a7282]" data-node-id="87:547">
                LOCATION
              </dt>
              <dd className="text-[#1e2939] dark:text-white/90" data-node-id="87:549">
                Vancouver, BC
              </dd>
            </div>
            <div className="flex flex-col gap-0.5" data-node-id="87:551">
              <dt className="text-[#6a7282]" data-node-id="87:552">
                THINGS TO REMEMBER
              </dt>
              <dd
                className="text-[#1e2939] leading-relaxed dark:text-white/90"
                data-node-id="87:555"
              >
                A little salty but a great egg snack, especially with rice.
                Loves hiking and is always late.
              </dd>
            </div>
          </dl>

          {/* Custom attributes (node 91:578) */}
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] text-[#6a7282]" data-node-id="91:578">
              CUSTOM ATTRIBUTES
            </p>
            <div className="flex items-center gap-1.5" data-node-id="91:580">
              <span
                className="text-[11px] text-[#1e2939] dark:text-white/90"
                data-node-id="91:582"
              >
                Birthday: 2002-09-21
              </span>
              <img
                src={Assets.imgCalendarAlt}
                alt=""
                className="h-3.5 w-3.5 shrink-0 opacity-60"
                aria-hidden
                data-node-id="91:584"
              />
            </div>
          </div>

          {/* Photos label (node 91:586) */}
          <p className="mt-3 text-[11px] text-[#6a7282]" data-node-id="91:586">
            PHOTOS
          </p>
        </div>

        {/* ── Right: Create Constellations (nodes 87:504–87:525) ── */}
        <div className="flex flex-col gap-4">
          {/* "CREATE CONSTELLATIONS" heading (node 87:506) */}
          <h3
            className="text-[#4a5565] dark:text-[#c8d0da]"
            style={{
              fontFamily: 'Sohne, sans-serif',
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '0.96px',
              lineHeight: '1',
            }}
            data-node-id="87:506"
          >
            CREATE CONSTELLATIONS
          </h3>

          {/* Description (node 87:504–87:505) */}
          <p
            className="text-[20px] leading-relaxed tracking-[0.35px] text-[#4a5565] dark:text-[#8a96a4]"
            data-node-id="87:505"
          >
            Sort people into any categories you want. Click any group to watch
            its constellation light up across your graph.
          </p>

          {/* Constellation SVG visualization */}
          <svg
            viewBox="0 0 220 140"
            className="h-auto w-full max-w-[260px]"
            aria-hidden
            data-node-id="87:507"
          >
            <defs>
              <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Dim background nodes */}
            <circle cx="170" cy="30" r="5" fill="rgba(161,205,247,0.3)" />
            <circle cx="192" cy="78" r="4" fill="rgba(161,205,247,0.25)" />
            <circle cx="178" cy="108" r="5" fill="rgba(161,205,247,0.3)" />
            <circle cx="150" cy="52" r="3.5" fill="rgba(161,205,247,0.2)" />

            {/* Constellation connecting lines (dashed, animated) */}
            <line x1="48" y1="60" x2="92" y2="86" stroke="#88c4dc" strokeWidth="1.5" strokeDasharray="4 3" className="landing-constellation-line" />
            <line x1="92" y1="86" x2="114" y2="40" stroke="#88c4dc" strokeWidth="1.5" strokeDasharray="4 3" className="landing-constellation-line" style={{ animationDelay: '0.15s' }} />
            <line x1="114" y1="40" x2="48" y2="60" stroke="#88c4dc" strokeWidth="1.5" strokeDasharray="4 3" className="landing-constellation-line" style={{ animationDelay: '0.3s' }} />
            <line x1="92" y1="86" x2="92" y2="120" stroke="#88c4dc" strokeWidth="1" strokeDasharray="3 3" className="landing-constellation-line" style={{ animationDelay: '0.45s' }} />

            {/* Glow rings */}
            <circle cx="48" cy="60" r="11" fill="none" stroke="rgba(136,196,220,0.35)" strokeWidth="1" className="landing-constellation-line" />
            <circle cx="92" cy="86" r="11" fill="none" stroke="rgba(136,196,220,0.35)" strokeWidth="1" className="landing-constellation-line" style={{ animationDelay: '0.2s' }} />
            <circle cx="114" cy="40" r="11" fill="none" stroke="rgba(136,196,220,0.35)" strokeWidth="1" className="landing-constellation-line" style={{ animationDelay: '0.4s' }} />

            {/* Blue constellation nodes */}
            <circle cx="48" cy="60" r="7" fill="#88c4dc" filter="url(#glow-blue)" />
            <circle cx="92" cy="86" r="7" fill="#88c4dc" filter="url(#glow-blue)" />
            <circle cx="114" cy="40" r="7" fill="#88c4dc" filter="url(#glow-blue)" />
            <circle cx="92" cy="120" r="5" fill="#a2cdf7" opacity="0.7" />
          </svg>

          {/* "Close Friends" badge (node 87:521–87:525) */}
          <div
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#a2cdf7] bg-[#fafafa] px-2.5 py-1 text-[10px] font-medium text-[#4a5565] dark:bg-zinc-900/60 dark:text-[#c8d0da]"
            data-node-id="87:522"
          >
            <span className="text-[#a2cdf7]" aria-hidden>
              ●
            </span>
            Close Friends
          </div>
        </div>

      </div>
    </section>
  )
}

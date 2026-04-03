import { imgCalendarAlt } from '@/lib/figma-landing-assets'

export function LandingFeatureCards() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 sm:px-0" aria-labelledby="features-heading">
      <h2 id="features-heading" className="sr-only">
        Features
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Card 1 — Node profiles */}
      <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/60">
        <div className="border-b border-gray-100 p-4 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Remember everything
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Every person gets a profile. Store birthdays, allergies, favourite things,
            how you met, upcoming plans, and how you feel about them — all in one place.
          </p>
        </div>
        <div className="flex flex-1 flex-col bg-zinc-50 p-4 dark:bg-zinc-950/80">
          {/* Figma node 87:532 — person detail card */}
          <div
            className="rounded-xl border border-[rgba(212,212,216,0.8)] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900/60"
            data-node-id="87:532"
          >
            <div className="flex gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(180deg, #8e51ff 0%, #acffc1 100%)' }}
                aria-hidden
              >
                ME
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#101828] dark:text-white">
                  Mayak Egg
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(0,188,125,0.15)', color: '#007a55' }}>
                    Close Friend
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(142,81,255,0.15)', color: '#31009f' }}>
                    Colleague
                  </span>
                </div>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[#6a7282]">LOCATION</dt>
                <dd className="text-[#1e2939] dark:text-white/90">Vancouver, BC</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[#6a7282]">THINGS TO REMEMBER</dt>
                <dd className="text-[#1e2939] leading-relaxed dark:text-white/90">
                  A little salty but a great egg snack, especially with rice.
                  Loves hiking and is always late.
                </dd>
              </div>
            </dl>
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] text-[#6a7282]">CUSTOM ATTRIBUTES</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#1e2939] dark:text-white/90">
                  Birthday: 2002-09-21
                </span>
                <img src={imgCalendarAlt} alt="" className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[#6a7282]">PHOTOS</p>
          </div>
        </div>
      </article>

      {/* Card 2 — Communities */}
      <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/60">
        <div className="border-b border-gray-100 p-4 dark:border-white/10">
          <h3 className="text-black font-semibold">
            Create constellations
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Sort people into any categories you want. Click any group to watch its
            constellation light up across your graph.
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-3 py-6 dark:bg-zinc-950/80">
          <svg
            viewBox="0 0 220 120"
            className="h-auto w-full max-w-[220px]"
            aria-hidden
          >
            <defs>
              <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Dim nodes */}
            <circle cx="165" cy="28" r="6" className="fill-gray-300/40 dark:fill-gray-600/35" />
            <circle cx="188" cy="72" r="6" className="fill-gray-300/40 dark:fill-gray-600/35" />
            <circle cx="175" cy="100" r="6" className="fill-gray-300/40 dark:fill-gray-600/35" />
            <circle cx="148" cy="48" r="5" className="fill-gray-300/35 dark:fill-gray-600/30" />
            {/* Constellation lines */}
            <line
              x1="52"
              y1="58"
              x2="88"
              y2="82"
              stroke="#a78bfa"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className="landing-constellation-line"
            />
            <line
              x1="88"
              y1="82"
              x2="108"
              y2="42"
              stroke="#a78bfa"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className="landing-constellation-line"
            />
            <line
              x1="108"
              y1="42"
              x2="52"
              y2="58"
              stroke="#a78bfa"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className="landing-constellation-line"
              style={{ animationDelay: '0.3s' }}
            />
            {/* Glow rings */}
            <circle
              cx="52"
              cy="58"
              r="11"
              fill="none"
              stroke="rgba(167,139,250,0.35)"
              strokeWidth="1"
              className="landing-constellation-line"
            />
            <circle
              cx="88"
              cy="82"
              r="11"
              fill="none"
              stroke="rgba(167,139,250,0.35)"
              strokeWidth="1"
              className="landing-constellation-line"
              style={{ animationDelay: '0.2s' }}
            />
            <circle
              cx="108"
              cy="42"
              r="11"
              fill="none"
              stroke="rgba(167,139,250,0.35)"
              strokeWidth="1"
              className="landing-constellation-line"
              style={{ animationDelay: '0.4s' }}
            />
            {/* Purple nodes */}
            <circle
              cx="52"
              cy="58"
              r="7"
              fill="#a78bfa"
              filter="url(#glow-purple)"
              className="drop-shadow-[0_0_6px_rgba(167,139,250,0.7)]"
            />
            <circle
              cx="88"
              cy="82"
              r="7"
              fill="#a78bfa"
              className="drop-shadow-[0_0_6px_rgba(167,139,250,0.7)]"
            />
            <circle
              cx="108"
              cy="42"
              r="7"
              fill="#a78bfa"
              className="drop-shadow-[0_0_6px_rgba(167,139,250,0.7)]"
            />
          </svg>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-800 dark:text-violet-200">
            <span className="text-violet-500" aria-hidden>
              ●
            </span>
            Close Friends
          </div>
        </div>
      </article>

      {/* Card 3 — Edges */}
      <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/60">
        <div className="border-b border-gray-100 p-4 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Connect anyone
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Draw a line between any two people to represent any kind of
            relationship. Friends, rivals, family — you define it.
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-3 py-8 dark:bg-zinc-950/80">
          <svg
            viewBox="0 0 240 72"
            className="h-auto w-full max-w-[240px] text-gray-600 dark:text-gray-400"
            aria-hidden
          >
            <line
              x1="28"
              y1="36"
              x2="212"
              y2="36"
              stroke="rgba(167,139,250,0.45)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="184"
              className="landing-edge-line"
            />
            <circle cx="28" cy="36" r="9" fill="#34d399" className="drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]" />
            <circle cx="212" cy="36" r="9" fill="#a78bfa" className="drop-shadow-[0_0_8px_rgba(167,139,250,0.55)]" />
            <text
              x="28"
              y="58"
              textAnchor="middle"
              fill="currentColor"
              className="text-[10px] text-gray-600 dark:text-gray-400"
            >
              Jordan
            </text>
            <text
              x="212"
              y="58"
              textAnchor="middle"
              fill="currentColor"
              className="text-[10px] text-gray-600 dark:text-gray-400"
            >
              Priya
            </text>
            <g>
              <rect
                x="92"
                y="22"
                width="72"
                height="18"
                rx="9"
                className="fill-white/95 dark:fill-zinc-800/95"
                stroke="rgba(167,139,250,0.35)"
                strokeWidth="1"
              />
              <text
                x="128"
                y="34"
                textAnchor="middle"
                fill="currentColor"
                className="text-[9px] font-medium text-violet-700 dark:text-violet-300"
              >
                Close Friend
              </text>
            </g>
          </svg>
          <button
            type="button"
            tabIndex={-1}
            className="landing-ghost-pulse pointer-events-none rounded-lg border border-dashed border-zinc-300/80 bg-transparent px-3 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
          >
            + Add connection
          </button>
        </div>
      </article>
      </div>
    </section>
  )
}

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
          <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <div className="flex gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}
                aria-hidden
              >
                ME
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Mayak Egg
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                    Close Friend
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    Colleague
                  </span>
                </div>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-[11px] text-gray-600 dark:text-gray-400">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500 dark:text-gray-500">
                  🎂 Birthday
                </dt>
                <dd className="text-gray-800 dark:text-white/90">March 15 · in 47 days</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500 dark:text-gray-500">
                  📍 Location
                </dt>
                <dd className="text-gray-500 dark:text-gray-500">Vancouver</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500 dark:text-gray-500">
                  📝 Note
                </dt>
                <dd className="text-gray-800 dark:text-white/90">
                  Loves hiking and terrible puns
                </dd>
              </div>
            </dl>
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
            Organize people into any categories you want. Click any group to watch its
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

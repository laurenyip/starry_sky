'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const HEADLINES = [
  'Adopted by cool people for dope shit',
  'Adopted by industry leaders and developers worldwide',
] as const

const SCRAMBLE_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,!@#$✦*-_/|'

function randomChar(): string {
  return SCRAMBLE_CHARSET[Math.floor(Math.random() * SCRAMBLE_CHARSET.length)]!
}

const ROW_1 = [
  'Keane Moraes',
  'Mia Chen',
  'Matthew Kuo',
  'Jordan Park',
  'Ayse Apacik',
  'Alex Rivera',
  'Yoona Charland',
  'Sophie Kim',
  'Brian Rahadi',
  'Marcus Webb',
  'Hemant Dhokia',
  'Zara Ahmed',
  'Yogya Agrawal',
  "Finn O'Brien",
  'Lena Bauer',
  'Kai Nakamura',
  'Isla Scott',
  'Remy Dubois',
  'Nadia Osei',
  'Theo Walsh',
]

const ROW_2 = [
  'Soren Berg',
  'Mila Russo',
  'Jayson Tram',
  'Ash Brennan',
  'Vera Popov',
  'Eric Cosma',
  'Indigo Flores',
  'Luca Ferrari',
  'Han Pham',
  'Reed Nakamura',
  'Sage Butler',
  'Aria Kovacs',
  'Flynn Nguyen',
  'Ines Carvalho',
  'Rex Yamamoto',
  'Tara Okafor',
  'Dex Williams',
  'Orion Castillo',
  'Faye Lin',
  'Cruz Mendez',
]

const FADE_MASK: CSSProperties = {
  maskImage:
    'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
}

const TICK_MS = 30
const SCRAMBLE_TICKS = 10
const STABLE_MS = 3500

export function SocialProof() {
  const [displayText, setDisplayText] = useState<string>(HEADLINES[0])
  const [isScrambling, setIsScrambling] = useState(false)
  const headlineIndexRef = useRef(0)
  const scrambleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stableTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearScramble = useCallback(() => {
    if (scrambleIntervalRef.current) {
      clearInterval(scrambleIntervalRef.current)
      scrambleIntervalRef.current = null
    }
  }, [])

  const runScrambleTo = useCallback(
    (target: string, onDone?: () => void) => {
      clearScramble()
      setIsScrambling(true)
      const n = target.length
      let step = 0

      const applyStep = () => {
        const resolved = Math.min(n, Math.floor(((step + 1) * n) / SCRAMBLE_TICKS))
        let s = ''
        for (let i = 0; i < n; i++) {
          if (i < resolved) {
            s += target[i]!
          } else if (target[i] === ' ') {
            s += ' '
          } else {
            s += randomChar()
          }
        }
        setDisplayText(s)
      }

      scrambleIntervalRef.current = setInterval(() => {
        applyStep()
        step += 1
        if (step >= SCRAMBLE_TICKS) {
          clearScramble()
          setDisplayText(target)
          setIsScrambling(false)
          onDone?.()
        }
      }, TICK_MS)
    },
    [clearScramble]
  )

  useEffect(() => {
    const queueNext = () => {
      if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current)
      stableTimeoutRef.current = setTimeout(() => {
        const next = (headlineIndexRef.current + 1) % HEADLINES.length
        headlineIndexRef.current = next
        runScrambleTo(HEADLINES[next], () => {
          queueNext()
        })
      }, STABLE_MS)
    }

    stableTimeoutRef.current = setTimeout(() => {
      const next = (headlineIndexRef.current + 1) % HEADLINES.length
      headlineIndexRef.current = next
      runScrambleTo(HEADLINES[next], () => {
        queueNext()
      })
    }, STABLE_MS)

    return () => {
      clearScramble()
      if (stableTimeoutRef.current) clearTimeout(stableTimeoutRef.current)
    }
  }, [clearScramble, runScrambleTo])

  return (
    <section className="flex w-full min-w-0 flex-col items-center gap-8 overflow-hidden py-16">
      <p
        className={`max-w-[min(100%,42rem)] text-center text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 sm:text-sm ${
          isScrambling ? 'font-mono' : 'font-sans'
        }`}
      >
        {displayText}
      </p>

      <div className="flex w-full flex-col gap-3">
        <div className="w-full overflow-hidden" style={FADE_MASK}>
          <div className="flex w-max gap-3 animate-scroll-left hover:[animation-play-state:paused]">
            {[...ROW_1, ...ROW_1].map((name, i) => (
              <span
                key={`r1-${i}-${name}`}
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-4 py-1.5 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
              >
                <span className="mr-1.5 text-gray-300 dark:text-gray-600" aria-hidden>
                  ✦
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full overflow-hidden" style={FADE_MASK}>
          <div className="flex w-max gap-3 animate-scroll-right hover:[animation-play-state:paused]">
            {[...ROW_2, ...ROW_2].map((name, i) => (
              <span
                key={`r2-${i}-${name}`}
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-4 py-1.5 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400"
              >
                <span className="mr-1.5 text-gray-300 dark:text-gray-600" aria-hidden>
                  ✦
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

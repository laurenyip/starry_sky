'use client'

/**
 * Figma node 64:261 — Social proof section.
 * "Adopted by cool people for dope shit" headline with scramble animation.
 * Two scrolling rows of person pills, each with a colored ✦ star per Figma spec.
 */
import { useLandingGlassStyle } from '@/components/landing/use-landing-glass-style'
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

const ROW_1: [string, string][] = [
  ['Keane Moraes', '#FC9874'],
  ['Mia Chen', '#8BC5DD'],
  ['Matthew Kuo', '#7154A6'],
  ['Jordan Park', '#FA899D'],
  ['Ayse Apacik', '#FE9F67'],
  ['Alex Rivera', '#8277C6'],
  ['Yoona Charland', '#F6C2C4'],
  ['Sophie Kim', '#FC9874'],
  ['Brian Rahadi', '#8BC5DD'],
  ['Marcus Webb', '#7154A6'],
  ['Hemant Dhokia', '#FA899D'],
  ['Zara Ahmed', '#FE9F67'],
  ['Yogya Agrawal', '#8277C6'],
  ["Finn O'Brien", '#F6C2C4'],
  ['Lena Bauer', '#FC9874'],
  ['Kai Nakamura', '#8BC5DD'],
  ['Isla Scott', '#7154A6'],
  ['Remy Dubois', '#FA899D'],
  ['Nadia Osei', '#FE9F67'],
  ['Theo Walsh', '#8277C6'],
]

const ROW_2: [string, string][] = [
  ['Soren Berg', '#F6C2C4'],
  ['Mila Russo', '#FC9874'],
  ['Jayson Tram', '#8BC5DD'],
  ['Ash Brennan', '#7154A6'],
  ['Vera Popov', '#FA899D'],
  ['Eric Cosma', '#FE9F67'],
  ['Indigo Flores', '#8277C6'],
  ['Luca Ferrari', '#F6C2C4'],
  ['Han Pham', '#FC9874'],
  ['Reed Nakamura', '#8BC5DD'],
  ['Sage Butler', '#7154A6'],
  ['Aria Kovacs', '#FA899D'],
  ['Flynn Nguyen', '#FE9F67'],
  ['Ines Carvalho', '#8277C6'],
  ['Rex Yamamoto', '#F6C2C4'],
  ['Tara Okafor', '#FC9874'],
  ['Dex Williams', '#8BC5DD'],
  ['Orion Castillo', '#7154A6'],
  ['Faye Lin', '#FA899D'],
  ['Cruz Mendez', '#FE9F67'],
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
  const glassStyle = useLandingGlassStyle()
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

  const pillClass =
    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-[17px] py-[7px] text-[14px] text-gray-900 dark:!text-white'

  return (
    <section
      className="flex w-full min-w-0 flex-col items-center gap-6 overflow-hidden px-1 py-12 sm:gap-8 sm:py-16"
      data-node-id="64:261"
    >
      <p
        className={`max-w-[min(100%,42rem)] px-2 text-center text-[11px] uppercase leading-snug tracking-[1.2px] text-gray-500 dark:text-gray-300 sm:text-[12px] ${
          isScrambling ? 'font-mono' : 'font-sans'
        }`}
      >
        {displayText}
      </p>

      <div className="flex w-full flex-col gap-3">
        <div className="w-full overflow-hidden" style={FADE_MASK}>
          <div className="flex w-max gap-3 animate-scroll-left hover:[animation-play-state:paused]">
            {[...ROW_1, ...ROW_1].map(([name, starColor], i) => (
              <span key={`r1-${i}-${name}`} className={pillClass} style={glassStyle}>
                <span
                  className="shrink-0 text-[14px] leading-none"
                  style={{ color: starColor }}
                  aria-hidden
                >
                  ✦
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full overflow-hidden" style={FADE_MASK}>
          <div className="flex w-max gap-3 animate-scroll-right hover:[animation-play-state:paused]">
            {[...ROW_2, ...ROW_2].map(([name, starColor], i) => (
              <span key={`r2-${i}-${name}`} className={pillClass} style={glassStyle}>
                <span
                  className="shrink-0 text-[14px] leading-none"
                  style={{ color: starColor }}
                  aria-hidden
                >
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

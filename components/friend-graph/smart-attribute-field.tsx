'use client'

import { DateAttributeField } from '@/components/friend-graph/date-attribute-field'
import { birthdayAge, canonicalDate } from '@/lib/date-attribute-helpers'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export function getAttrType(key: string): string {
  const k = key.toLowerCase().trim()

  if (
    k.includes('birthday') ||
    k.includes('birth date') ||
    k.includes('dob') ||
    k.includes('date of birth')
  )
    return 'birthday'

  if (k.includes('anniversary')) return 'anniversary'

  if (k.includes('met') || k.includes('how we met') || k.includes('first met'))
    return 'met_date'

  if (
    k.includes('plan') ||
    k.includes('upcoming') ||
    k.includes('event') ||
    k.includes('trip') ||
    k.includes('visit') ||
    k.includes('reminder')
  )
    return 'upcoming'

  if (
    k.includes('phone') ||
    k.includes('mobile') ||
    k.includes('cell') ||
    k.includes('number') ||
    k.includes('tel')
  )
    return 'phone'

  if (k.includes('email') || k.includes('e-mail') || k.includes('mail'))
    return 'email'

  if (
    k.includes('address') ||
    k.includes('street') ||
    k.includes('suburb') ||
    k.includes('postcode') ||
    k.includes('zip')
  )
    return 'address'

  if (
    k.includes('website') ||
    k.includes('url') ||
    k.includes('link') ||
    k.includes('site') ||
    k.includes('portfolio') ||
    k.includes('blog')
  )
    return 'url'

  if (
    k.includes('instagram') ||
    k.includes('twitter') ||
    k.includes('x.com') ||
    k.includes('tiktok') ||
    k.includes('linkedin') ||
    k.includes('facebook') ||
    k.includes('youtube') ||
    k.includes('snapchat') ||
    k.includes('github') ||
    k.includes('reddit') ||
    k.includes('discord') ||
    k.includes('twitch') ||
    k.includes('pinterest') ||
    k.includes('threads')
  )
    return 'social'

  if (
    k.includes('colour') ||
    k.includes('color') ||
    k.includes('favourite colour') ||
    k.includes('fav color')
  )
    return 'colour'

  if (
    k.includes('food') ||
    k.includes('cuisine') ||
    k.includes('dish') ||
    k.includes('meal') ||
    k.includes('snack') ||
    k.includes('drink') ||
    k.includes('coffee') ||
    k.includes('tea')
  )
    return 'food'

  if (
    k.includes('hobby') ||
    k.includes('hobbies') ||
    k.includes('interest') ||
    k.includes('passion') ||
    k.includes('activity') ||
    k.includes('sport')
  )
    return 'tags_list'

  if (
    k.includes('job') ||
    k.includes('role') ||
    k.includes('title') ||
    k.includes('position') ||
    k.includes('occupation') ||
    k.includes('career') ||
    k.includes('profession')
  )
    return 'job'

  if (
    k.includes('company') ||
    k.includes('employer') ||
    k.includes('workplace') ||
    k.includes('organisation') ||
    k.includes('organization') ||
    k.includes('firm')
  )
    return 'company'

  if (
    k.includes('school') ||
    k.includes('university') ||
    k.includes('college') ||
    k.includes('degree') ||
    k.includes('education') ||
    k.includes('studied') ||
    k.includes('major') ||
    k.includes('course')
  )
    return 'education'

  if (k.includes('pronouns') || k.includes('pronoun')) return 'pronouns'

  if (k.includes('gender') || k.includes('sexuality') || k.includes('orientation'))
    return 'text_plain'

  if (
    k.includes('nationality') ||
    k.includes('country') ||
    k.includes('citizenship') ||
    k.includes('origin')
  )
    return 'text_plain'

  if (k.includes('language') || k.includes('speaks') || k.includes('tongue'))
    return 'tags_list'

  if (k.includes('height') || k.includes('tall')) return 'height'

  if (k.includes('age')) return 'age'

  if (k.includes('rating') || k.includes('score') || k.includes('rank') || k.includes('stars'))
    return 'rating'

  if (k.includes('note') || k.includes('memo') || k.includes('remember') || k.includes('thought'))
    return 'textarea'

  if (k.includes('gift') || k.includes('wishlist') || k.includes('wants') || k.includes('wish'))
    return 'tags_list'

  if (
    k.includes('allergies') ||
    k.includes('allergy') ||
    k.includes('intolerance') ||
    k.includes('dietary')
  )
    return 'tags_list'

  if (k.includes('pet') || k.includes('dog') || k.includes('cat') || k.includes('animal'))
    return 'text_plain'

  if (
    k.includes('salary') ||
    k.includes('income') ||
    k.includes('wage') ||
    k.includes('pay')
  )
    return 'currency'

  return 'text_plain'
}

const HEIGHT_UNIT_KEY = 'starmap_height_unit'

const inputBase =
  'border-b border-gray-200 bg-transparent py-0.5 text-sm outline-none focus:border-blue-400 dark:border-gray-700 w-full'

function useSavedFlash(onSave: () => void) {
  const [savedFlash, setSavedFlash] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerSave = useCallback(() => {
    setSavedFlash(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSavedFlash(false), 1500)
    onSave()
  }, [onSave])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const hint = savedFlash ? (
    <p className="mt-0.5 text-xs text-gray-400 transition-opacity">Saved ✓</p>
  ) : null

  return { triggerSave, hint }
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function formatPhoneDisplay(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const d = digitsOnly(t)
  if (d.length === 11 && d.startsWith('1')) {
    const n = d.slice(1)
    if (n.length === 10) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
  }
  if (d.length === 10 && (t.startsWith('+1') || /^1\d{10}$/.test(d))) {
    return `(${d.slice(-10, -7)}) ${d.slice(-7, -4)}-${d.slice(-4)}`
  }
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return t
}

function telHref(raw: string): string {
  const d = digitsOnly(raw)
  if (!d) return 'tel:'
  if (d.length === 10) return `tel:+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `tel:+${d}`
  return `tel:+${d}`
}

function isValidEmail(s: string): boolean {
  const t = s.trim()
  const at = t.indexOf('@')
  if (at < 1) return false
  return t.slice(at + 1).includes('.')
}

function normalizeUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function isValidUrl(raw: string): boolean {
  const t = normalizeUrl(raw)
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function truncateUrl(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

export type SocialPlatform =
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'linkedin'
  | 'github'
  | 'facebook'
  | 'youtube'
  | 'reddit'
  | 'discord'
  | 'twitch'
  | 'pinterest'
  | 'threads'
  | 'snapchat'
  | 'generic'

export function detectSocialPlatform(attrKey: string): SocialPlatform {
  const k = attrKey.toLowerCase()
  if (k.includes('instagram')) return 'instagram'
  if (k.includes('twitter') || k.includes('x.com')) return 'twitter'
  if (k.includes('tiktok')) return 'tiktok'
  if (k.includes('linkedin')) return 'linkedin'
  if (k.includes('github')) return 'github'
  if (k.includes('facebook')) return 'facebook'
  if (k.includes('youtube')) return 'youtube'
  if (k.includes('reddit')) return 'reddit'
  if (k.includes('discord')) return 'discord'
  if (k.includes('twitch')) return 'twitch'
  if (k.includes('pinterest')) return 'pinterest'
  if (k.includes('threads')) return 'threads'
  if (k.includes('snapchat')) return 'snapchat'
  return 'generic'
}

function socialLabel(p: SocialPlatform): string {
  switch (p) {
    case 'instagram':
      return 'IG'
    case 'twitter':
      return 'X'
    case 'tiktok':
      return 'TikTok'
    case 'linkedin':
      return 'LinkedIn'
    case 'github':
      return 'GitHub'
    case 'facebook':
      return 'Facebook'
    case 'youtube':
      return 'YouTube'
    case 'reddit':
      return 'Reddit'
    case 'discord':
      return 'Discord'
    case 'twitch':
      return 'Twitch'
    case 'pinterest':
      return 'Pinterest'
    case 'threads':
      return 'Threads'
    case 'snapchat':
      return 'Snapchat'
    default:
      return 'Social'
  }
}

function socialProfileUrl(platform: SocialPlatform, handle: string): string | null {
  const h = handle.replace(/^@/, '').trim()
  if (!h) return null
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${encodeURIComponent(h)}`
    case 'twitter':
      return `https://x.com/${encodeURIComponent(h)}`
    case 'tiktok':
      return `https://tiktok.com/@${encodeURIComponent(h)}`
    case 'linkedin':
      return `https://linkedin.com/in/${encodeURIComponent(h)}`
    case 'github':
      return `https://github.com/${encodeURIComponent(h)}`
    case 'facebook':
      return `https://facebook.com/${encodeURIComponent(h)}`
    case 'youtube':
      return `https://youtube.com/@${encodeURIComponent(h)}`
    case 'reddit':
      return `https://reddit.com/u/${encodeURIComponent(h)}`
    case 'twitch':
      return `https://twitch.tv/${encodeURIComponent(h)}`
    case 'pinterest':
      return `https://pinterest.com/${encodeURIComponent(h)}`
    case 'threads':
      return `https://threads.net/@${encodeURIComponent(h)}`
    case 'discord':
    case 'snapchat':
    case 'generic':
      return null
    default:
      return null
  }
}

function parseTagsJson(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  try {
    const j = JSON.parse(t) as unknown
    if (Array.isArray(j)) {
      return j.map((x) => String(x).trim()).filter(Boolean)
    }
  } catch {
    /* single tag */
  }
  return [t]
}

function serializeTagsJson(tags: string[]): string {
  if (tags.length === 0) return ''
  return JSON.stringify(tags)
}

type CurrencyCode = 'USD' | 'GBP' | 'EUR' | 'JPY' | 'AUD'

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  JPY: '¥',
  AUD: 'A$',
}

function parseCurrencyValue(raw: string): { amount: number; currency: CurrencyCode } {
  const t = raw.trim()
  if (!t) return { amount: 0, currency: 'USD' }
  try {
    const j = JSON.parse(t) as unknown
    if (j && typeof j === 'object' && j !== null && 'amount' in j) {
      const o = j as Record<string, unknown>
      const amount = Number(o.amount)
      const c = String(o.currency ?? 'USD').toUpperCase()
      const cur = (['USD', 'GBP', 'EUR', 'JPY', 'AUD'] as const).includes(c as CurrencyCode)
        ? (c as CurrencyCode)
        : 'USD'
      return { amount: Number.isFinite(amount) ? amount : 0, currency: cur }
    }
  } catch {
    /* plain */
  }
  const n = Number(t.replace(/[^0-9.-]/g, ''))
  return { amount: Number.isFinite(n) ? n : 0, currency: 'USD' }
}

function formatCurrencyDisplay(amount: number, currency: CurrencyCode): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount)
  } catch {
    return `${CURRENCY_SYMBOLS[currency]}${amount.toLocaleString()}`
  }
}

function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = cm / 2.54
  const ft = Math.floor(totalIn / 12)
  let inch = Math.round(totalIn - ft * 12)
  if (inch >= 12) inch = 11
  return { ft, inch }
}

function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * 2.54)
}

function findBirthdayYmd(all: Record<string, string> | undefined): string | null {
  if (!all) return null
  for (const [k, v] of Object.entries(all)) {
    if (getAttrType(k) === 'birthday' && v.trim()) {
      const c = canonicalDate(v)
      if (c.canonical) return c.canonical
    }
  }
  return null
}

function iconRow(icon: string, node: ReactNode) {
  return (
    <div className="flex w-full items-start gap-1.5">
      <span className="shrink-0 pt-0.5 text-gray-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{node}</div>
    </div>
  )
}

type Props = {
  attrKey: string
  value: string
  onChange: (next: string) => void
  onSave: () => void
  allAttributes?: Record<string, string>
}

export function SmartAttributeField({
  attrKey,
  value,
  onChange,
  onSave,
  allAttributes,
}: Props) {
  const { triggerSave, hint } = useSavedFlash(onSave)
  const t = getAttrType(attrKey)

  if (t === 'birthday' || t === 'anniversary' || t === 'met_date' || t === 'upcoming') {
    return (
      <div className="space-y-1">
        <DateAttributeField
          attrKey={attrKey}
          value={value}
          onChange={onChange}
          onBlurPersist={triggerSave}
        />
        {hint}
      </div>
    )
  }

  return (
    <SmartBody
      attrKey={attrKey}
      attrType={t}
      value={value}
      onChange={onChange}
      onSave={triggerSave}
      savedHint={hint}
      allAttributes={allAttributes}
    />
  )
}

type BodyProps = {
  attrKey: string
  attrType: string
  value: string
  onChange: (next: string) => void
  onSave: () => void
  savedHint: ReactNode
  allAttributes?: Record<string, string>
}

function SmartBody({
  attrKey,
  attrType,
  value,
  onChange,
  onSave,
  savedHint,
  allAttributes,
}: BodyProps) {
  switch (attrType) {
    case 'phone':
      return (
        <PhoneBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'email':
      return (
        <EmailBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'address':
      return (
        <AddressBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'url':
      return <UrlBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
    case 'social':
      return (
        <SocialBlock
          attrKey={attrKey}
          value={value}
          onChange={onChange}
          onSave={onSave}
          savedHint={savedHint}
        />
      )
    case 'colour':
      return (
        <ColourBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'food':
      return (
        <div className="space-y-1">
          {iconRow(
            '🍽',
            <input
              type="text"
              className={inputBase}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onSave}
            />
          )}
          {savedHint}
        </div>
      )
    case 'tags_list':
      return (
        <TagsBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'job':
      return (
        <div className="space-y-1">
          {iconRow(
            '💼',
            <input
              type="text"
              className={inputBase}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onSave}
            />
          )}
          {savedHint}
        </div>
      )
    case 'company':
      return (
        <div className="space-y-1">
          {iconRow(
            '🏢',
            <input
              type="text"
              className={inputBase}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onSave}
            />
          )}
          {savedHint}
        </div>
      )
    case 'education':
      return (
        <div className="space-y-1">
          {iconRow(
            '🎓',
            <input
              type="text"
              className={inputBase}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onSave}
            />
          )}
          {savedHint}
        </div>
      )
    case 'pronouns':
      return (
        <PronounsBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'height':
      return (
        <HeightBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'age':
      return (
        <AgeBlock
          value={value}
          onChange={onChange}
          onSave={onSave}
          savedHint={savedHint}
          allAttributes={allAttributes}
        />
      )
    case 'rating':
      return (
        <RatingBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'currency':
      return (
        <CurrencyBlock value={value} onChange={onChange} onSave={onSave} savedHint={savedHint} />
      )
    case 'textarea':
      return (
        <div className="space-y-1">
          <textarea
            rows={3}
            className={`${inputBase} resize-y`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
          />
          {savedHint}
        </div>
      )
    default:
      return (
        <div className="space-y-1">
          <input
            type="text"
            className={inputBase}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
          />
          {savedHint}
        </div>
      )
  }
}

function PhoneBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const display = formatPhoneDisplay(draft)
  const href = telHref(draft)
  return (
    <div className="space-y-1">
      {iconRow(
        '📞',
        <>
          <input
            type="tel"
            placeholder="+1 (604) 555-0123"
            className={inputBase}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              onChange(draft.trim())
              onSave()
            }}
          />
          {display && href !== 'tel:' ? (
            <a href={href} className="mt-1 block text-sm text-blue-500 hover:underline">
              {display}
            </a>
          ) : null}
        </>
      )}
      {savedHint}
    </div>
  )
}

function EmailBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const [err, setErr] = useState(false)
  return (
    <div className="space-y-1">
      {iconRow(
        '✉',
        <>
          <input
            type="email"
            placeholder="name@example.com"
            className={inputBase}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setErr(false)
            }}
            onBlur={() => {
              const ok = !value.trim() || isValidEmail(value)
              setErr(Boolean(value.trim()) && !ok)
              if (!value.trim() || ok) onSave()
            }}
          />
          {err ? <p className="mt-0.5 text-xs text-amber-600">⚠ Not a valid email</p> : null}
          {value.trim() && isValidEmail(value) ? (
            <a
              href={`mailto:${value.trim()}`}
              className="mt-1 block text-sm text-blue-500 hover:underline"
            >
              {value.trim()}
            </a>
          ) : null}
        </>
      )}
      {savedHint}
    </div>
  )
}

function AddressBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  return (
    <div className="space-y-1">
      {iconRow(
        '📍',
        <>
          <textarea
            rows={3}
            className={`${inputBase} resize-y`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
          />
          {value.trim() ? (
            <>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                {value}
              </p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(value.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                Open in Maps
              </a>
            </>
          ) : null}
        </>
      )}
      {savedHint}
    </div>
  )
}

function UrlBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const [draft, setDraft] = useState(value)
  const [err, setErr] = useState(false)
  useEffect(() => setDraft(value), [value])
  const shown = normalizeUrl(value.trim())
  return (
    <div className="space-y-1">
      {iconRow(
        '🔗',
        <>
          <input
            type="url"
            placeholder="https://"
            className={inputBase}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setErr(false)
            }}
            onBlur={() => {
              let next = draft.trim()
              if (next && !/^https?:\/\//i.test(next)) next = `https://${next}`
              setDraft(next)
              onChange(next)
              setErr(Boolean(next) && !isValidUrl(next))
              onSave()
            }}
          />
          {err ? <p className="mt-0.5 text-xs text-amber-600">⚠ Invalid URL</p> : null}
          {value.trim() && isValidUrl(value) ? (
            <a
              href={shown}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block truncate text-sm text-blue-500 hover:underline"
              title={shown}
            >
              {truncateUrl(shown, 40)}
            </a>
          ) : null}
        </>
      )}
      {savedHint}
    </div>
  )
}

function SocialBlock({
  attrKey,
  value,
  onChange,
  onSave,
  savedHint,
}: {
  attrKey: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const platform = detectSocialPlatform(attrKey)
  const handle = value.replace(/^@/, '').trim()
  const url = socialProfileUrl(platform, handle)
  const label = socialLabel(platform)
  const displayInput = handle ? `@${handle}` : ''

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {label}
        {handle ? `: ${displayInput}` : ''}
      </p>
      <input
        type="text"
        placeholder="@username"
        className={inputBase}
        value={displayInput}
        onChange={(e) => {
          let v = e.target.value.trim()
          if (v.startsWith('@')) v = v.slice(1)
          onChange(v)
        }}
        onBlur={onSave}
      />
      {handle && url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-500 hover:underline"
        >
          {label}: @{handle}
        </a>
      ) : handle ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {label}: @{handle}
        </p>
      ) : null}
      {savedHint}
    </div>
  )
}

function ColourBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(value.trim()) ? value.trim() : '#888888'
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
          value={hex}
          onChange={(e) => {
            onChange(e.target.value)
            onSave()
          }}
        />
        <input
          type="text"
          className={inputBase}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          placeholder="#FF6B6B"
        />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-block h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-600"
          style={{ backgroundColor: hex }}
        />
        <span className="font-mono text-zinc-600 dark:text-zinc-400">{hex}</span>
      </div>
      {savedHint}
    </div>
  )
}

function TagsBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const tags = parseTagsJson(value)
  const [tagInput, setTagInput] = useState('')
  const pushTags = (next: string[]) => {
    onChange(serializeTagsJson(next))
    onSave()
  }
  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder="Type and press Enter to add..."
        className={inputBase}
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            const piece = tagInput.split(',')[0]?.trim()
            if (!piece) return
            if (!tags.includes(piece)) pushTags([...tags, piece])
            setTagInput('')
          }
        }}
        onBlur={() => {
          const piece = tagInput.split(',')[0]?.trim()
          if (piece && !tags.includes(piece)) pushTags([...tags, piece])
          setTagInput('')
        }}
      />
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-800"
            >
              {tag}
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                onClick={() => pushTags(tags.filter((x) => x !== tag))}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {savedHint}
    </div>
  )
}

const PRESET_PRONOUNS = ['he/him', 'she/her', 'they/them'] as const

function PronounsBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const isPreset = PRESET_PRONOUNS.includes(value as (typeof PRESET_PRONOUNS)[number])
  const [otherOpen, setOtherOpen] = useState(() => Boolean(value) && !isPreset)

  useEffect(() => {
    const preset = PRESET_PRONOUNS.includes(value as (typeof PRESET_PRONOUNS)[number])
    if (value && !preset) setOtherOpen(true)
    if (preset) setOtherOpen(false)
  }, [value])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {PRESET_PRONOUNS.map((o) => (
          <button
            key={o}
            type="button"
            className={`rounded-full border px-2 py-0.5 text-xs ${
              value === o
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                : 'border-zinc-300 dark:border-zinc-600'
            }`}
            onClick={() => {
              onChange(o)
              setOtherOpen(false)
              onSave()
            }}
          >
            {o}
          </button>
        ))}
        <button
          type="button"
          className={`rounded-full border px-2 py-0.5 text-xs ${
            otherOpen || (Boolean(value) && !isPreset)
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
              : 'border-zinc-300 dark:border-zinc-600'
          }`}
          onClick={() => {
            setOtherOpen(true)
            if (isPreset) onChange('')
          }}
        >
          other
        </button>
      </div>
      {(otherOpen || (Boolean(value) && !isPreset)) && (
        <input
          type="text"
          className={inputBase}
          value={isPreset ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          placeholder="Enter pronouns"
        />
      )}
      {savedHint}
    </div>
  )
}

function HeightBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const cm = Math.max(0, Math.round(Number(value) || 0))
  const { ft, inch } = cmToFtIn(cm)
  const [unit, setUnit] = useState<'imperial' | 'metric'>(() => {
    if (typeof window === 'undefined') return 'metric'
    return localStorage.getItem(HEIGHT_UNIT_KEY) === 'imperial' ? 'imperial' : 'metric'
  })

  const setCm = (n: number) => {
    onChange(String(Math.max(0, Math.round(n))))
    onSave()
  }

  const persistUnit = (u: 'imperial' | 'metric') => {
    setUnit(u)
    try {
      localStorage.setItem(HEIGHT_UNIT_KEY, u)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          className={`rounded px-2 py-0.5 ${
            unit === 'imperial' ? 'bg-zinc-200 dark:bg-zinc-700' : ''
          }`}
          onClick={() => persistUnit('imperial')}
        >
          imperial
        </button>
        <button
          type="button"
          className={`rounded px-2 py-0.5 ${
            unit === 'metric' ? 'bg-zinc-200 dark:bg-zinc-700' : ''
          }`}
          onClick={() => persistUnit('metric')}
        >
          metric
        </button>
      </div>
      {unit === 'metric' ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className={inputBase}
            value={cm || ''}
            onChange={(e) => setCm(Number(e.target.value))}
          />
          <span className="text-sm text-zinc-500">cm</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            className={`${inputBase} w-16`}
            value={ft}
            onChange={(e) => setCm(ftInToCm(Number(e.target.value) || 0, inch))}
          />
          <span className="text-sm">ft</span>
          <input
            type="number"
            min={0}
            max={11}
            className={`${inputBase} w-14`}
            value={inch}
            onChange={(e) => setCm(ftInToCm(ft, Number(e.target.value) || 0))}
          />
          <span className="text-sm">in</span>
        </div>
      )}
      {savedHint}
    </div>
  )
}

function AgeBlock({
  value,
  onChange,
  onSave,
  savedHint,
  allAttributes,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
  allAttributes?: Record<string, string>
}) {
  const ymd = findBirthdayYmd(allAttributes)
  if (ymd) {
    const a = birthdayAge(ymd)
    return (
      <p className="text-sm italic text-gray-500 dark:text-gray-400">
        Computed from birthday{a != null ? `: ${a}` : ''}
      </p>
    )
  }
  return (
    <div className="space-y-1">
      <input
        type="number"
        min={0}
        max={130}
        className={inputBase}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
      />
      {savedHint}
    </div>
  )
}

function RatingBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const r = Math.min(5, Math.max(0, Math.round(Number(value) || 0)))
  const active = r || 0
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="text-lg text-amber-500 hover:opacity-90"
            onClick={() => {
              onChange(String(n))
              onSave()
            }}
            aria-label={`${n} stars`}
          >
            {n <= active ? '★' : '☆'}
          </button>
        ))}
      </div>
      {active > 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {[1, 2, 3, 4, 5].map((n) => (n <= active ? '★' : '☆')).join('')} ({active}/5)
        </p>
      ) : null}
      {savedHint}
    </div>
  )
}

function CurrencyBlock({
  value,
  onChange,
  onSave,
  savedHint,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  savedHint: ReactNode
}) {
  const parsed = parseCurrencyValue(value)
  const [draftAmount, setDraftAmount] = useState(String(parsed.amount || ''))
  const [draftCur, setDraftCur] = useState<CurrencyCode>(parsed.currency)

  useEffect(() => {
    const p = parseCurrencyValue(value)
    setDraftAmount(String(p.amount || ''))
    setDraftCur(p.currency)
  }, [value])

  const commit = (amountStr: string, cur: CurrencyCode) => {
    const n = Number(amountStr.replace(/[^0-9.-]/g, '')) || 0
    onChange(JSON.stringify({ amount: n, currency: cur }))
    onSave()
  }

  const displayVal = parseCurrencyValue(value)

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-400">{CURRENCY_SYMBOLS[draftCur]}</span>
        <input
          type="number"
          className={`${inputBase} min-w-0 flex-1`}
          value={draftAmount}
          onChange={(e) => setDraftAmount(e.target.value)}
          onBlur={() => commit(draftAmount, draftCur)}
        />
        <select
          className="border-b border-gray-200 bg-transparent text-sm dark:border-gray-700"
          value={draftCur}
          onChange={(e) => {
            const c = e.target.value as CurrencyCode
            setDraftCur(c)
            commit(draftAmount, c)
          }}
        >
          {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map((c) => (
            <option key={c} value={c}>
              {CURRENCY_SYMBOLS[c]} {c}
            </option>
          ))}
        </select>
      </div>
      {displayVal.amount > 0 ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {formatCurrencyDisplay(displayVal.amount, displayVal.currency)}
        </p>
      ) : null}
      {savedHint}
    </div>
  )
}

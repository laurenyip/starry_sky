'use client'

import {
  canonicalDate,
  daysUntilCalendarDate,
  daysUntilNextAnnualEvent,
  formatLongDate,
  fullYearsSince,
  getDateFieldType,
  isAnnualDateToday,
  parseUpcomingValue,
  serializeUpcoming,
} from '@/lib/date-attribute-helpers'
import type { ReactNode } from 'react'

type Props = {
  attrKey: string
  value: string
  onChange: (next: string) => void
  onBlurPersist: () => void
}

export function DateAttributeField({ attrKey, value, onChange, onBlurPersist }: Props) {
  const kind = getDateFieldType(attrKey)

  if (kind === 'upcoming') {
    const parsed = parseUpcomingValue(value)
    const invalid = parsed === null && value.trim().length > 0
    const dateStr = parsed?.date ?? ''
    const noteStr = parsed?.note ?? ''

    const cd = canonicalDate(dateStr)
    const hasValidDate = Boolean(cd.canonical)

    let upcomingMeta: ReactNode = null
    if (hasValidDate && cd.canonical) {
      const diff = daysUntilCalendarDate(cd.canonical)
      if (diff === null) upcomingMeta = null
      else if (diff < 0) {
        upcomingMeta = (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Passed ({formatLongDate(cd.canonical)})
          </p>
        )
      } else if (diff === 0) {
        upcomingMeta = (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">📅 Today!</p>
        )
      } else {
        upcomingMeta = (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            📅 in {diff} days
          </p>
        )
      }
    }

    return (
      <div className="space-y-1">
        <input
          type="date"
          className="w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
          value={cd.canonical ?? ''}
          onChange={(e) => {
            onChange(serializeUpcoming(e.target.value, noteStr))
          }}
          onBlur={onBlurPersist}
        />
        <input
          type="text"
          placeholder="Note (optional)"
          className="w-full border-b border-zinc-200 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-blue-400 dark:border-zinc-600"
          value={noteStr}
          onChange={(e) => {
            onChange(
              serializeUpcoming((dateStr || cd.canonical) ?? '', e.target.value)
            )
          }}
          onBlur={onBlurPersist}
        />
        {upcomingMeta}
        {invalid ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            ⚠ Could not read stored value. Fix below or re-enter.
            <span className="ml-1 font-mono text-[10px] text-zinc-500">{value}</span>
          </p>
        ) : null}
      </div>
    )
  }

  const c = canonicalDate(value)
  const ymd = c.canonical
  const birthdayGoogleCalendarUrl =
    kind === 'birthday' && ymd
      ? (() => {
          const compact = ymd.replace(/-/g, '')
          const nextDayDate = new Date(`${ymd}T00:00:00Z`)
          nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1)
          const nextDay = nextDayDate.toISOString().slice(0, 10).replace(/-/g, '')
          const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: 'Birthday Reminder',
            dates: `${compact}/${nextDay}`,
            recur: 'RRULE:FREQ=YEARLY',
            details: 'Birthday reminder from Starmap.',
          })
          return `https://calendar.google.com/calendar/render?${params.toString()}`
        })()
      : null

  let meta: ReactNode = null

  if (kind === 'birthday') {
    if (!c.parseable && value.trim()) {
      meta = (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
          ⚠ Unrecognised date format — use YYYY-MM-DD or pick a date.
          <span className="ml-1 font-mono text-[10px] text-zinc-500">{value}</span>
        </p>
      )
    }
  }

  if (kind === 'anniversary') {
    if (c.parseable && ymd) {
      const yrs = fullYearsSince(ymd)
      const until = daysUntilNextAnnualEvent(ymd)
      const todayA = isAnnualDateToday(ymd)
      meta = (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {formatLongDate(ymd)}
          {yrs != null
            ? ` · ${yrs} year${yrs === 1 ? '' : 's'}`
            : ''}
          {until !== null ? (
            <>
              {' · '}
              {todayA || until === 0
                ? '🎉 Today!'
                : `🎉 in ${until} days`}
            </>
          ) : null}
        </p>
      )
    } else if (value.trim()) {
      meta = (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
          ⚠ Unrecognised date format — use YYYY-MM-DD or pick a date.
          <span className="ml-1 font-mono text-[10px] text-zinc-500">{value}</span>
        </p>
      )
    }
  }

  if (kind === 'met') {
    if (c.parseable && ymd) {
      const yrs = fullYearsSince(ymd)
      meta = (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {formatLongDate(ymd)}
          {yrs != null
            ? ` · Known for ${yrs} year${yrs === 1 ? '' : 's'}`
            : ''}
        </p>
      )
    } else if (value.trim()) {
      meta = (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
          ⚠ Unrecognised date format — use YYYY-MM-DD or pick a date.
          <span className="ml-1 font-mono text-[10px] text-zinc-500">{value}</span>
        </p>
      )
    }
  }

  return (
    <>
      <input
        type="date"
        className="w-full border-b border-gray-300 bg-transparent px-1 py-0.5 text-sm outline-none focus:border-blue-400"
        value={ymd ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlurPersist}
      />
      {meta}
      {birthdayGoogleCalendarUrl ? (
        <a
          href={birthdayGoogleCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-blue-500 hover:underline"
        >
          Add yearly reminder to Google Calendar
        </a>
      ) : null}
    </>
  )
}

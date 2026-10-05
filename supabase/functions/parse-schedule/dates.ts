/**
 * parse-schedule — the dates, resolved by the server.
 *
 * Small models are good at reading a sentence and bad at calendar
 * arithmetic, so every date phrase we can recognise is resolved HERE and
 * written into the text in parentheses ("10일(2026-10-10)"); the model
 * copies it. This file is pure (no Deno APIs) so it can be tested with
 * plain node: tests/schedule-dates.test.mjs.
 */

const DAY_MS = 86400000
const pad = (n: number) => String(n).padStart(2, '0')

export interface Ymd { y: number; m: number; d: number }   // m is 1..12
export const fmt = (v: Ymd) => `${v.y}-${pad(v.m)}-${pad(v.d)}`
const utc = (v: Ymd) => Date.UTC(v.y, v.m - 1, v.d)
const fromUtc = (ms: number): Ymd => { const d = new Date(ms); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() } }
export const addDays = (v: Ymd, n: number): Ymd => fromUtc(utc(v) + n * DAY_MS)
const valid = (v: Ymd) => { const r = fromUtc(utc(v)); return v.m >= 1 && v.m <= 12 && v.d >= 1 && r.y === v.y && r.m === v.m && r.d === v.d }
/** Monday = 0 … Sunday = 6. */
const dow = (v: Ymd) => (new Date(utc(v)).getUTCDay() + 6) % 7
export const parseYmd = (s: string): Ymd | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const v = { y: +m[1]!, m: +m[2]!, d: +m[3]! }
  return valid(v) ? v : null
}

/** "Today" as the user's wall calendar reads it. */
export function todayIn (nowIso: string, timezone: string): Ymd {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowIso))
  return parseYmd(parts) ?? fromUtc(Date.parse(nowIso))
}

/** The calendar's "add to this day" bar sends `on YYYY-MM-DD: <text>`: the day that is open. */
export function splitAnchor (raw: string): { anchor: Ymd | null; text: string } {
  const m = /^\s*on (\d{4}-\d{2}-\d{2}):\s*/.exec(raw)
  const anchor = m ? parseYmd(m[1]!) : null
  return anchor ? { anchor, text: raw.slice(m![0].length) } : { anchor: null, text: raw }
}

const KDOW: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 }
const EDOW: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6, mon: 0, tue: 1, tues: 1, wed: 2, thu: 3, thur: 3, thurs: 3, fri: 4, sat: 5, sun: 6 }
const EMON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }
const emon = (s: string) => EMON[s.toLowerCase().slice(0, s.toLowerCase().startsWith('sept') ? 4 : 3)]

/** Written by musicians far more often as a metre than as a date: left for the model to read in context. */
const METRES = new Set(['2/2', '2/4', '3/4', '4/4', '5/4', '6/4', '7/4', '3/8', '5/8', '6/8', '7/8', '9/8', '12/8'])

export interface Resolved { text: string; dates: string[] }

/**
 * Write the absolute date after every date phrase we can resolve.
 *
 * `today` anchors the relative words (내일, 3일 뒤, 다음 주 금요일). A bare
 * day of the month ("10일", "the 10th") belongs to the month that is OPEN
 * in the calendar when there is one (`anchor`), otherwise to the nearest
 * such day from today on. A month and day with no year ("10월 10일",
 * "10/10", "oct 10") is this year's, or next year's once it is well past.
 */
export function resolveDates (input: string, today: Ymd, anchor: Ymd | null = null): Resolved {
  const dates: string[] = []
  const tag = (m: string, v: Ymd | null) => { if (!v || !valid(v)) return m; const s = fmt(v); dates.push(s); return `${m}(${s})` }
  const tIdx = dow(today)
  const inWeek = (target: number, weeks: number) => addDays(today, weeks * 7 + (target - tIdx))
  const nearest = (target: number) => addDays(today, (target - tIdx + 7) % 7)

  /** M/D with no year: the open day's year (else this year) — next year once that is more than a month gone. */
  const monthDay = (m: number, d: number): Ymd | null => {
    let v = { y: (anchor ?? today).y, m, d }
    if (!valid(v)) return null
    if (utc(v) < utc(today) - 31 * DAY_MS) v = { y: v.y + 1, m, d }
    return valid(v) ? v : null
  }
  /** A bare day number: in the open month when the calendar is on another month; otherwise the next time that day comes round. */
  const dayOfMonth = (d: number): Ymd | null => {
    if (d < 1 || d > 31) return null
    if (anchor && (anchor.y !== today.y || anchor.m !== today.m)) { const v = { y: anchor.y, m: anchor.m, d }; return valid(v) ? v : null }
    for (let k = 0; k < 3; k++) {
      const mm = today.m - 1 + k, v = { y: today.y + Math.floor(mm / 12), m: (mm % 12) + 1, d }
      if (valid(v) && utc(v) >= utc(today)) return v
    }
    return null
  }
  const shiftMonth = (k: number, d: number): Ymd | null => {
    const base = anchor ?? today, mm = base.m - 1 + k
    const v = { y: base.y + Math.floor(mm / 12), m: (mm % 12) + 1, d }
    return valid(v) ? v : null
  }

  // a phrase already carrying its date is left alone: (?!\() after every match
  const text = input
    // ── whole dates ──────────────────────────────────────────────────
    .replace(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?(?!\d)(?!\()/g, (m, y, mo, d) => tag(m, { y: +y, m: +mo, d: +d }))
    .replace(/(?<![\d.\-/])(\d{1,2})\s*월\s*(\d{1,2})\s*일(?!\()/g, (m, mo, d) => tag(m, monthDay(+mo, +d)))
    .replace(/(이번|다음|담|다다음)\s*달\s*(\d{1,2})\s*일(?!\()/g, (m, w, d) => tag(m, shiftMonth(w === '이번' ? 0 : w === '다다음' ? 2 : 1, +d)))
    .replace(/(?<![\d:.\/])(\d{1,2})\/(\d{1,2})(?![\d:\/])(?!\()/g, (m, mo, d) => (METRES.has(m) ? m : tag(m, monthDay(+mo, +d))))   // 6/8 is a metre here, not june the 8th
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!\()/gi, (m, mo, d) => tag(m, monthDay(emon(mo)!, +d)))
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b(?!\()/gi, (m, d, mo) => tag(m, monthDay(emon(mo)!, +d)))
    // ── counted from today ───────────────────────────────────────────
    .replace(/(\d{1,3})\s*일\s*(뒤|후|있다가|이따)(?!\()/g, (m, n) => tag(m, addDays(today, +n)))
    .replace(/(\d{1,2})\s*주(일)?\s*(뒤|후)(?!\()/g, (m, n) => tag(m, addDays(today, +n * 7)))
    .replace(/\bin\s+(\d{1,3})\s+days?\b(?!\()/gi, (m, n) => tag(m, addDays(today, +n)))
    .replace(/\bin\s+(\d{1,2})\s+weeks?\b(?!\()/gi, (m, n) => tag(m, addDays(today, +n * 7)))
    // ── weekdays ─────────────────────────────────────────────────────
    .replace(/(이번|다음|다다음|담)\s*주\s*(월|화|수|목|금|토|일)(요일)?(?!\()/g, (m, w, d) => tag(m, inWeek(KDOW[d]!, w === '이번' ? 0 : w === '다다음' ? 2 : 1)))
    .replace(/(?<![가-힣])(월|화|수|목|금|토|일)요일(?!\()/g, (m, d) => tag(m, nearest(KDOW[d]!)))
    .replace(/\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thur?s?|fri|sat|sun)\b(?!\()/gi, (m, w, d) => tag(m, inWeek(EDOW[d.toLowerCase()]!, w.toLowerCase() === 'this' ? 0 : 1)))
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?!\()/gi, (m) => tag(m, nearest(EDOW[m.toLowerCase()]!)))
    // ── relative day words (longest first: 내일모레 before 내일) ─────────
    .replace(/내일\s*모레(?!\()|(?<!내일\s*)모레(?!\()/g, (m) => tag(m, addDays(today, 2)))
    .replace(/글피(?!\()/g, (m) => tag(m, addDays(today, 3)))
    .replace(/내일(?!\s*모레)(?!\()/g, (m) => tag(m, addDays(today, 1)))
    .replace(/오늘(?!\()/g, (m) => tag(m, today))
    .replace(/\bday after tomorrow\b(?!\()/gi, (m) => tag(m, addDays(today, 2)))
    .replace(/(?<!after )\btomorrow\b(?!\()/gi, (m) => tag(m, addDays(today, 1)))
    .replace(/\btoday\b(?!\()/gi, (m) => tag(m, today))
    // ── a bare day of the month, last: everything longer has its date by now ──
    .replace(/(?<![\d월달\-/.])(\d{1,2})\s*일(?![\d(])/g, (m, d, at: number, all: string) => {
      const rest = all.slice(at + m.length)
      if (/(\d{1,2}\s*월|달)\s*$/.test(all.slice(0, at))) return m   // "2월 30일": a month and day that did not make a date is not a bare day either
      if (/^\s*(뒤|후|전|간|동안|있다가|이따|째|차|치|마다|만에|짜리|씩|밖에|요일|연속|내내|정도\s*(걸|남))/.test(rest)) return m   // a count of days, or 일요일
      if (/^[가-힣]/.test(rest) && !/^(에|날|은|는|이|도|까지|부터|쯤|경|엔|로|의|이나|이랑|하고|이고)/.test(rest)) return m       // part of another word
      return tag(m, dayOfMonth(+d))
    })
    .replace(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\()/gi, (m, d) => tag(m, dayOfMonth(+d)))   // "on the 10th" — never a bare "2nd verse"

  return { text, dates }
}

/** Three weeks of the user's calendar as a lookup table, for the phrases we did not resolve ("주말", "next weekend"). */
export function calendarTable (today: Ymd): { todayLine: string; table: string } {
  const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const tIdx = dow(today)
  const rows: string[] = []
  for (let i = 0; i < 21; i++) {
    const v = addDays(today, i)
    const week = Math.floor((i + tIdx) / 7)
    const weekLabel = week === 0 ? 'this week (이번 주)' : week === 1 ? 'next week (다음 주)' : 'week after next (다다음 주)'
    // no "in N days" labels past 글피: a model reads "10일" as "in 10 days" off such a row
    const rel = i === 0 ? ' — TODAY (오늘)' : i === 1 ? ' — tomorrow (내일)' : i === 2 ? ' — 모레' : i === 3 ? ' — 글피' : ''
    rows.push(`${fmt(v)} = ${NAMES[dow(v)]}${rel} — ${weekLabel}`)
  }
  return { todayLine: `${fmt(today)} (${NAMES[tIdx]})`, table: rows.join('\n') }
}

/** What still names a date after tagging (read on the TAGGED text); with none of these, an event's date is not the model's to choose. */
const LOOSE_DATE = new RegExp([
  '주말', '평일', '(다음|담|이번|다다음|지난|저번)\\s*(주|달)(?!\\s*[월화수목금토일]요?일?\\()(?!\\s*\\d{1,2}\\s*일\\()', '매주', '매일', '매달', '격주',
  '다음\\s*날', '전날', '이튿날', '익일', '당일', '월\\s*(초|말|중순)', '\\d{1,2}\\s*월(?!\\s*\\d{1,2}\\s*일\\()', '연말', '연초', '추석', '설날', '설\\s*연휴', '크리스마스', '성탄', '어린이날', '광복절', '개천절', '한글날',
  '\\d{1,2}\\/\\d{1,2}(?![\\d(])', '\\d{1,2}(st|nd|rd|th)\\b(?!\\()',
  'weekend', 'weekday', '(next|this|last)\\s+(week|month)', 'every\\s', 'next day', 'day after(?! tomorrow)', 'day before', 'christmas', 'new year', 'thanksgiving', 'easter',
  '\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\b(?!\\()(?!\\.?\\s+\\d{1,2}(st|nd|rd|th)?\\()',
].join('|'), 'i')

export interface ParsedEvent { title?: string; date?: string; [k: string]: unknown }

/**
 * The model's dates, held to what the text said.
 *
 * - A date that is not a real YYYY-MM-DD falls back to the open day, or today.
 * - Nothing in the text names a date → every event is on the open day (or today).
 * - The text names exactly ONE date → that is every event's date.
 * - It names several, as many as there are events → they pair up in order
 *   whenever the model's set of dates differs from the text's.
 */
export function settleDates<T extends ParsedEvent> (events: T[], resolved: Resolved, today: Ymd, anchor: Ymd | null): T[] {
  const fallback = fmt(anchor ?? today)
  const named = [...new Set(resolved.dates)]
  const loose = LOOSE_DATE.test(resolved.text)
  const out = events.map(e => ({ ...e, date: parseYmd(String(e.date ?? '')) ? String(e.date) : fallback }))
  if (loose) return out
  if (named.length === 0) return out.map(e => ({ ...e, date: fallback }))
  if (named.length === 1) return out.map(e => ({ ...e, date: named[0]! }))
  const got = new Set(out.map(e => e.date))
  const agree = out.every(e => named.includes(e.date)) && named.every(d => got.has(d))
  if (!agree && resolved.dates.length === out.length) return out.map((e, i) => ({ ...e, date: resolved.dates[i]! }))
  return out
}

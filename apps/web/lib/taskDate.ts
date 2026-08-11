/**
 * Typed due dates for wall tasks — no native picker (house rule; same
 * doctrine as release dates). The composer shows the parsed result live
 * so a misread is visible before saving.
 *
 * Accepts: 오늘/내일/(내일)모레/글피, today/tomorrow/tmr, weekday names
 * (금요일 / friday / fri → nearest future, same day rolls a week),
 * 다음주 금요일 / next friday, 8/15 · 8.15 · 8월 15일 (year defaults to
 * this year, rolls forward if already past), 2026.8.15, bare 15일.
 */

const KR_REL: Record<string, number> = { 오늘: 0, 내일: 1, 내일모레: 2, 모레: 2, 글피: 3 }
const EN_REL: Record<string, number> = { today: 0, tomorrow: 1, tmr: 1 }
const KR_DOW: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }
const EN_DOW: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function parseTaskDate(raw: string, now = new Date()): Date | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  const today = midnight(now)
  const addDays = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d
  }

  if (s in KR_REL) return addDays(KR_REL[s]!)
  if (s in EN_REL) return addDays(EN_REL[s]!)

  // Weekday — nearest future; naming today's own day means next week.
  const nextWeek = /^(다음\s*주|다다음\s*주|next)\s*/.exec(s)
  const rest = nextWeek ? s.slice(nextWeek[0].length).trim() : s
  const krDow = /^([일월화수목금토])요일?$/.exec(rest)
  const dow = krDow ? KR_DOW[krDow[1]!] : EN_DOW[rest]
  if (dow !== undefined) {
    const base = ((dow - today.getDay() + 6) % 7) + 1 // 1..7, never today
    const extra = nextWeek ? (nextWeek[1]!.startsWith('다다음') ? 14 : 7) : 0
    return addDays(base + extra)
  }

  // Full date: 2026.8.15 / 2026-08-15 / 2026년 8월 15일
  let m = /^(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})일?$/.exec(s)
  if (m) {
    const d = new Date(+m[1]!, +m[2]! - 1, +m[3]!)
    return isNaN(d.getTime()) ? null : d
  }
  // Month + day: 8/15 · 8.15 · 8월 15일 — rolls to next year if past.
  m = /^(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})일?$/.exec(s)
  if (m) {
    const mo = +m[1]!, day = +m[2]!
    if (mo < 1 || mo > 12 || day < 1 || day > 31) return null
    let d = new Date(today.getFullYear(), mo - 1, day)
    if (d < today) d = new Date(today.getFullYear() + 1, mo - 1, day)
    return d
  }
  // Bare day: 15일 — this month, rolls to next month if past.
  m = /^(\d{1,2})일$/.exec(s)
  if (m) {
    const day = +m[1]!
    if (day < 1 || day > 31) return null
    let d = new Date(today.getFullYear(), today.getMonth(), day)
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day)
    return d
  }
  return null
}

/** "today" / "tomorrow" / "fri 15 aug" (+ year when it isn't this one). */
export function fmtTaskDate(iso: string, now = new Date()): string {
  const d = midnight(new Date(iso))
  const today = midnight(now)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  const base = d
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .toLowerCase()
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** Past its day and still not done. */
export function isOverdue(iso: string, now = new Date()): boolean {
  return midnight(new Date(iso)) < midnight(now)
}

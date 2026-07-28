/**
 * Supabase Edge Function: parse-schedule
 *
 * Takes a free-text schedule ("내일 3시 회의, 토요일 점심 약속") and returns
 * structured calendar events. The Anthropic API key lives ONLY here as a
 * Supabase secret — it never reaches the client or the repo.
 *
 * Setup:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   # optional: pick a model (defaults to a cheap, fast Haiku)
 *   supabase secrets set ANTHROPIC_MODEL=claude-3-5-haiku-latest
 *   supabase functions deploy parse-schedule
 *
 * Request  (POST, authenticated):
 *   { text: string, timezone?: string, now?: string }
 * Response:
 *   { events: Array<{
 *       title: string, date: string (YYYY-MM-DD),
 *       start_time: string|null (HH:MM, 24h), end_time: string|null,
 *       all_day: boolean, location: string|null
 *     }> }
 */

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/**
 * Render the user's local calendar for the next ~3 weeks as a lookup
 * table. Relative-date phrases ("다음 주 토요일", "this Friday") become a
 * table lookup instead of model arithmetic — which is where small models
 * make weekday mistakes.
 */
function calendarTable(nowIso: string, timezone: string): { today: string; table: string; annotate: (text: string) => string } {
  const now = new Date(nowIso)
  const dayMs = 86400000
  const fmtDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const fmtDow = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' })
  const dateAt = (offset: number) => fmtDate.format(new Date(now.getTime() + offset * dayMs))

  const DOWS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  // Monday-start week index of "today", used to label this/next week.
  const todayIdx = DOWS.indexOf(fmtDow.format(now))

  const rows: string[] = []
  let todayLine = ''
  for (let i = 0; i < 21; i++) {
    const d = new Date(now.getTime() + i * dayMs)
    const date = fmtDate.format(d)
    const dow = fmtDow.format(d)
    // Which Monday-start week does day i fall in, relative to today?
    const week = Math.floor((i + todayIdx) / 7)
    const weekLabel = week === 0 ? 'this week (이번 주)' : week === 1 ? 'next week (다음 주)' : 'week after next (다다음 주)'
    const rel = i === 0 ? 'TODAY (오늘)' : i === 1 ? 'tomorrow (내일)' : i === 2 ? 'in 2 days (모레)' : i === 3 ? 'in 3 days (글피)' : `in ${i} days`
    if (i === 0) todayLine = `${date} (${dow})`
    rows.push(`${date} = ${dow} — ${rel} — ${weekLabel}`)
  }

  // Deterministic pre-resolution: annotate unambiguous relative-date
  // phrases with their absolute date, right in the user text ("모레" →
  // "모레(2026-07-30)"). The model just copies the parenthesised date —
  // no lookup, no arithmetic, no prior about what 모레 means.
  const KDOW: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 }
  const EDOW: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  }
  const weekdayOffset = (targetIdx: number, weeks: number) =>
    weeks === 0 ? targetIdx - todayIdx : weeks * 7 + (targetIdx - todayIdx)
  const nearestOffset = (targetIdx: number) => (targetIdx - todayIdx + 7) % 7

  const annotate = (text: string): string =>
    text
      // Korean: week-qualified weekdays first (담주 = colloquial 다음 주)
      .replace(/(이번|다음|다다음|담)\s*주\s*(월|화|수|목|금|토|일)(요일)?/g, (m, week, d, suffix) => {
        const weeks = week === '이번' ? 0 : week === '다다음' ? 2 : 1
        const off = weekdayOffset(KDOW[d]!, weeks)
        return off < 0 || off > 20 ? m : `${m}(${dateAt(off)})`
      })
      // Bare weekday → nearest future occurrence (today included).
      // (?!\() skips weekdays the week-qualified pass already annotated.
      .replace(/(월|화|수|목|금|토|일)요일(?!\()/g, (m, d) => `${m}(${dateAt(nearestOffset(KDOW[d]!))})`)
      // Relative day words — longest first so 내일모레 wins over 내일
      .replace(/내일\s*모레|모레/g, (m) => `${m}(${dateAt(2)})`)
      .replace(/글피/g, (m) => `${m}(${dateAt(3)})`)
      .replace(/내일(?!\s*모레)(?!\()/g, (m) => `${m}(${dateAt(1)})`)
      .replace(/오늘/g, (m) => `${m}(${dateAt(0)})`)
      // English
      .replace(/\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, (m, w, d) => {
        const off = weekdayOffset(EDOW[d.toLowerCase()]!, w.toLowerCase() === 'this' ? 0 : 1)
        return off < 0 || off > 20 ? m : `${m}(${dateAt(off)})`
      })
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?!\()/gi, (m) => {
        const key = m.toLowerCase()
        return `${m}(${dateAt(nearestOffset(EDOW[key]!))})`
      })
      .replace(/\btomorrow\b(?!\()/gi, (m) => `${m}(${dateAt(1)})`)
      .replace(/\btoday\b(?!\()/gi, (m) => `${m}(${dateAt(0)})`)

  return { today: todayLine, table: rows.join('\n'), annotate }
}

const SAVE_EVENTS_TOOL = {
  name: 'save_events',
  description: 'Save the calendar events extracted from the user text.',
  input_schema: {
    type: 'object',
    properties: {
      resolution: {
        type: 'string',
        description: 'Work through the dates BEFORE filling events, as a NUMBERED list with one entry per event: N) "<exact date/time phrase quoted from the text>" -> <the ONE matching calendar-table row copied verbatim> -> <resolved time with am/pm reasoning>. The copied row\'s labels must contain the quoted keyword (e.g. a phrase with 모레 must copy the row labeled 모레; a named weekday must appear in the row). Then fill events to agree with this list exactly.',
      },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short event title, in the language the user wrote.' },
            date: { type: 'string', description: 'Calendar date, YYYY-MM-DD, resolved to an absolute date.' },
            start_time: { type: ['string', 'null'], description: 'Start time HH:MM 24-hour, or null if no time was given.' },
            end_time: { type: ['string', 'null'], description: 'End time HH:MM 24-hour, or null if not given.' },
            all_day: { type: 'boolean', description: 'True when no specific time is given.' },
            location: { type: ['string', 'null'], description: 'Location if mentioned, else null.' },
            category: { type: ['string', 'null'], description: 'A short, reusable category in the user\'s language (e.g. 약속, 공연, 합주, 레슨, 회의, 개인). Prefer a small consistent set; null if truly unclear.' },
          },
          required: ['title', 'date', 'all_day'],
        },
      },
    },
    required: ['resolution', 'events'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // trim() guards against a trailing newline/space slipping into the secret.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)

  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: { text?: string; timezone?: string; now?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid JSON' }, 400) }

  const text = (body.text ?? '').trim()
  if (!text) return json({ error: 'empty text' }, 400)

  const timezone = body.timezone || 'UTC'
  const now = body.now || new Date().toISOString()

  const cal = calendarTable(now, timezone)

  const system = [
    'You convert a person\'s free-text notes into structured calendar events.',
    `Today, in the user's timezone (${timezone}), is ${cal.today}.`,
    '',
    'CALENDAR TABLE — resolve EVERY date by looking it up here. Never compute dates or weekdays yourself:',
    cal.table,
    '',
    'Some date phrases in the user text carry a pre-resolved date in parentheses, e.g. "모레(2026-07-30)".',
    'These are computed by the server and are AUTHORITATIVE — always use that exact date and do not',
    'include the parenthesised date in the event title.',
    '',
    'Date rules (weeks start on MONDAY):',
    '- "이번 주 X요일" / "this X" → the row for weekday X labeled "this week".',
    '- "다음 주 X요일" / "next X" → the row for weekday X labeled "next week". NEVER a different weekday: 다음 주 토요일 must land on a Saturday row.',
    '- A bare weekday ("토요일에", "on Friday") → the NEAREST future row with that weekday (today counts if the time is still ahead).',
    '- "주말" → the nearest Saturday; "다음 주 주말" → the "next week" Saturday.',
    '- 내일 = tomorrow = the "tomorrow (내일)" row. 모레 = the DAY AFTER tomorrow = the "in 2 days (모레)" row — never the tomorrow row. 글피 = the "in 3 days (글피)" row.',
    '- Copy the YYYY-MM-DD exactly from the matched row.',
    '',
    'Time rules: use 24-hour HH:MM. 아침/오전/morning = am; 오후/저녁/밤/afternoon/evening/night = pm (저녁 7시 = 19:00).',
    'A bare 1–7 o\'clock for social or work events usually means pm; 8–11 usually means am unless context says otherwise.',
    'If no time is stated, set all_day=true and leave start_time/end_time null.',
    '',
    'Extract EVERY distinct event in the text. Keep titles short and in the user\'s own language.',
    'Also classify each event into a short, reusable category (in the user\'s language, e.g.',
    '약속/공연/합주/레슨/회의/개인) — prefer a small consistent set so the same kind of event always',
    'gets the same category. Never invent events that are not in the text.',
    'Always respond by calling the save_events tool. Fill the "resolution" field FIRST —',
    'quote each date phrase and copy its matching table row — then fill "events" to agree with it.',
  ].join('\n')

  const aReq = {
    model: MODEL,
    max_tokens: 2048,
    // Extraction wants determinism — greedy decoding kills the stochastic
    // off-by-one-day slips on multi-event sentences.
    temperature: 0,
    system,
    tools: [SAVE_EVENTS_TOOL],
    tool_choice: { type: 'tool', name: 'save_events' },
    messages: [{ role: 'user', content: cal.annotate(text) }],
  }

  let resp: Response
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(aReq),
    })
  } catch (e) {
    console.error('[parse-schedule] fetch failed', e)
    return json({ error: 'upstream request failed' }, 502)
  }

  if (!resp.ok) {
    const detail = await resp.text()
    console.error('[parse-schedule] anthropic error', resp.status, detail)
    return json({ error: 'AI request failed', status: resp.status }, 502)
  }

  const data = await resp.json()
  const toolUse = (data.content ?? []).find(
    (c: { type: string; name?: string }) => c.type === 'tool_use' && c.name === 'save_events',
  )
  const events = toolUse?.input?.events
  if (!Array.isArray(events)) {
    console.error('[parse-schedule] no tool_use in response', JSON.stringify(data).slice(0, 500))
    return json({ events: [] })
  }

  // resolution is the model's date working — clients ignore it, but it
  // makes server-side debugging of a misparsed date trivial.
  return json({ events, resolution: toolUse?.input?.resolution ?? null })
})

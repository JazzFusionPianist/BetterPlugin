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

import { calendarTable, resolveDates, settleDates, splitAnchor, todayIn, fmt } from './dates.ts'

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control':'private, no-store' },
  })

const SAVE_EVENTS_TOOL = {
  name: 'save_events',
  description: 'Save the calendar events extracted from the user text.',
  input_schema: {
    type: 'object',
    properties: {
      resolution: {
        type: 'string',
        description: 'Work through the dates BEFORE filling events, as a NUMBERED list with one entry per event: N) "<exact date/time phrase quoted from the text>" -> <its parenthesised date copied verbatim, or the ONE matching calendar-table row for a phrase with no parenthesised date> -> <resolved time with am/pm reasoning>. Then fill events to agree with this list exactly.',
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

  const authorization=req.headers.get('authorization')??''
  if(!/^Bearer [^\s]+$/.test(authorization))return json({error:'Sign in required'},401)
  const check=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/security_rate_limit`,{
    method:'POST',headers:{authorization,apikey:Deno.env.get('SUPABASE_ANON_KEY')??'','Content-Type':'application/json'},
    body:JSON.stringify({p_action:'schedule'}),signal:AbortSignal.timeout(10000),
  }).catch(()=>null)
  if(!check?.ok)return json({error:'Request not authorized or rate limited'},403)
  let body: { text?: string; timezone?: string; now?: string; consent?:boolean }
  try {
    const reader=req.body?.getReader();if(!reader)throw new Error('Missing body')
    let total=0;const parts:Uint8Array[]=[]
    try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>16384)throw new Error('Too large');parts.push(value)}}finally{await reader.cancel()}
    const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
    body=JSON.parse(new TextDecoder().decode(bytes))
    if(body.consent!==true || typeof body.text!=='string' || body.text.length>8000)throw new Error('Invalid request')
  } catch { return json({ error: 'invalid JSON' }, 400) }

  const raw = (body.text ?? '').trim()
  if (!raw) return json({ error: 'empty text' }, 400)

  const timezone = body.timezone || 'UTC'
  const now = body.now || new Date().toISOString()

  // Dates are the server's: every phrase it can resolve is written into the
  // text as "phrase(YYYY-MM-DD)", and the model's answer is held to them.
  const today = todayIn(now, timezone)
  const { anchor, text } = splitAnchor(raw)          // the calendar's open day, if the text came from its add bar
  const resolved = resolveDates(text, today, anchor)
  const cal = calendarTable(today)
  const openDay = anchor ? fmt(anchor) : null

  const system = [
    'You convert a person\'s free-text notes into structured calendar events.',
    `Today, in the user's timezone (${timezone}), is ${cal.todayLine}.`,
    ...(openDay ? [`The user is writing into the calendar day ${openDay}: an event whose text names no date of its own is on ${openDay}.`] : []),
    '',
    'DATES ARE PRE-RESOLVED. Date phrases in the user text carry their date in parentheses, e.g.',
    '"10일(2026-10-10)", "모레(2026-07-30)", "next friday(2026-10-16)". The server computed these and they are',
    'AUTHORITATIVE: copy that exact YYYY-MM-DD for the event the phrase belongs to. Never change it, never',
    'add or subtract days from it, and do not put the parenthesised date in the title.',
    '"N일" is the N-th DAY OF THE MONTH (10일 = the 10th), never "N days from now".',
    '',
    'Only for a date phrase that has NO parenthesised date (e.g. "주말", "next weekend", "추석"), look it up here —',
    'never compute dates or weekdays yourself:',
    cal.table,
    '',
    'Rules for those un-annotated phrases (weeks start on MONDAY):',
    '- "주말" → the nearest Saturday; "다음 주 주말" → the "next week" Saturday.',
    '- A week with no weekday ("다음 주에") → that week\'s Monday.',
    '- Copy the YYYY-MM-DD exactly from the matched row.',
    `- If the text names no date at all, use ${openDay ?? 'today'}.`,
    '',
    'Time rules: use 24-hour HH:MM. 아침/오전/morning = am; 오후/저녁/밤/afternoon/evening/night = pm (저녁 7시 = 19:00).',
    'A bare 1–7 o\'clock for social or work events usually means pm; 8–11 usually means am unless context says otherwise.',
    '"N시 반" = N:30. A range ("3시부터 5시", "3-5시") fills start_time and end_time.',
    'If no time is stated, set all_day=true and leave start_time/end_time null.',
    '',
    'Extract EVERY distinct event in the text. Keep titles short and in the user\'s own language.',
    'Also classify each event into a short, reusable category (in the user\'s language, e.g.',
    '약속/공연/합주/레슨/회의/개인) — prefer a small consistent set so the same kind of event always',
    'gets the same category. Never invent events that are not in the text.',
    'Always respond by calling the save_events tool. Fill the "resolution" field FIRST —',
    'quote each date phrase with the date you will use for it — then fill "events" to agree with it.',
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
    messages: [{ role: 'user', content: resolved.text }],
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
      signal: AbortSignal.timeout(30000),
    })
  } catch (e) {
    console.error('[parse-schedule] fetch failed', e)
    return json({ error: 'upstream request failed' }, 502)
  }

  if (!resp.ok) {
    console.error('[parse-schedule] upstream status', resp.status)
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

  // The model reads the sentence; the dates are the server's (see dates.ts).
  const settled = settleDates(events, resolved, today, anchor)

  // resolution is the model's date working — clients ignore it, but it
  // makes server-side debugging of a misparsed date trivial.
  return json({ events: settled, resolution: toolUse?.input?.resolution ?? null })
})

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

const SAVE_EVENTS_TOOL = {
  name: 'save_events',
  description: 'Save the calendar events extracted from the user text.',
  input_schema: {
    type: 'object',
    properties: {
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
          },
          required: ['title', 'date', 'all_day'],
        },
      },
    },
    required: ['events'],
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

  const system = [
    'You convert a person\'s free-text notes into structured calendar events.',
    `The current date/time is ${now} and the user\'s timezone is ${timezone}.`,
    'Resolve every relative date ("today", "tomorrow", "내일", "다음 주 화요일", "this Friday")',
    'to an absolute YYYY-MM-DD using that current date and timezone.',
    'Extract EVERY distinct event in the text. If no time is stated, set all_day=true',
    'and leave start_time/end_time null. Use 24-hour HH:MM. Keep titles short and in the',
    'user\'s own language. Never invent events that are not in the text.',
    'Always respond by calling the save_events tool.',
  ].join(' ')

  const aReq = {
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: [SAVE_EVENTS_TOOL],
    tool_choice: { type: 'tool', name: 'save_events' },
    messages: [{ role: 'user', content: text }],
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

  return json({ events })
})

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewCalendarEvent } from '../hooks/useCalendarEvents'

/** Raw event shape returned by the parse-schedule edge function. */
interface ParsedEvent {
  title: string
  date: string                 // YYYY-MM-DD
  start_time?: string | null   // HH:MM (24h)
  end_time?: string | null
  all_day?: boolean
  location?: string | null
  category?: string | null
}

export class ScheduleParseError extends Error {}

/**
 * Build a local Date from a YYYY-MM-DD (+ optional HH:MM). The string has no
 * timezone suffix, so JS interprets it in the device's local zone — which is
 * exactly the zone we told the model to resolve against.
 */
function localISO(date: string, time?: string | null): string {
  const d = new Date(`${date}T${time && /^\d{1,2}:\d{2}$/.test(time) ? time : '00:00'}:00`)
  if (isNaN(d.getTime())) throw new ScheduleParseError(`bad date/time: ${date} ${time ?? ''}`)
  return d.toISOString()
}

function toNewEvent(e: ParsedEvent): NewCalendarEvent {
  const allDay = e.all_day || !e.start_time
  const starts_at = localISO(e.date, allDay ? null : e.start_time)
  let ends_at: string | null = null
  if (!allDay && e.end_time) {
    const end = localISO(e.date, e.end_time)
    // Ignore an end that isn't after the start (e.g. parsing slip).
    if (end > starts_at) ends_at = end
  }
  return {
    title: e.title.trim() || 'Untitled',
    starts_at,
    ends_at,
    all_day: allDay,
    location: e.location?.trim() || null,
    category: e.category?.trim() || null,
    source: 'prompt',
  }
}

/**
 * Send free text to the AI parser and return ready-to-insert calendar
 * events. Throws ScheduleParseError with a user-friendly message on failure
 * (e.g. the edge function isn't deployed yet).
 */
export async function parseSchedule(
  supabase: SupabaseClient,
  text: string,
): Promise<NewCalendarEvent[]> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const { data, error } = await supabase.functions.invoke('parse-schedule', {
    body: { text, timezone, now: new Date().toISOString() },
  })

  if (error) {
    // Most common cause early on: the function isn't deployed / secret unset.
    throw new ScheduleParseError(
      'Could not reach the schedule AI. Make sure the parse-schedule function is deployed and ANTHROPIC_API_KEY is set.',
    )
  }

  const parsed = (data?.events ?? []) as ParsedEvent[]
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ScheduleParseError('No events found in that text. Try being more specific about dates/times.')
  }

  return parsed
    .filter((e) => e && e.title && e.date)
    .map(toNewEvent)
}

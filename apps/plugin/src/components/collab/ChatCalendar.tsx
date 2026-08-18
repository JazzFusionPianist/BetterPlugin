import CalendarPanel, { type EventPatch } from './CalendarPanel'
import SchedulePrompt from './SchedulePrompt'
import type { CalendarEvent } from '../../hooks/useCalendarEvents'
import type { EventCategory } from '../../hooks/useEventCategories'

interface Props {
  currentUserId: string
  /** Events already filtered to this conversation. */
  events: CalendarEvent[]
  categories: EventCategory[]
  groupTitleById: Map<string, string>
  onDelete: (id: string) => void
  onSetCategory: (id: string, name: string) => void
  onUpdate: (id: string, patch: EventPatch) => void
  onAddCategory: (name: string) => void
  onRenameCategory: (id: string, name: string) => void
  onDeleteCategory: (id: string) => void
  /** Free-text prompt → parse → persist (scoped to this chat by the
   *  parent; the prompt's own target picker is hidden). */
  onSubmitPrompt: (text: string) => Promise<CalendarEvent[]>
}

/**
 * The calendar, re-homed inside a chat (2026-08-10): a slide-over that
 * shows only THIS conversation's shared events. The plugin-wide
 * calendar is gone — plans live where they're made, next to the
 * conversation that made them. Entry: the small calendar glyph in the
 * chat header; the schedule prompt at the bottom writes straight into
 * this chat's calendar.
 */
export default function ChatCalendar({
  currentUserId, events, categories, groupTitleById,
  onDelete, onSetCategory, onUpdate, onAddCategory, onRenameCategory, onDeleteCategory,
  onSubmitPrompt,
}: Props) {
  return (
    <div className="chatcal">
      <div className="chatcal-body">
        <CalendarPanel
          events={events}
          categories={categories}
          currentUserId={currentUserId}
          groupTitleById={groupTitleById}
          onDelete={onDelete}
          onSetCategory={onSetCategory}
          onUpdate={onUpdate}
          onAddCategory={onAddCategory}
          onRenameCategory={onRenameCategory}
          onDeleteCategory={onDeleteCategory}
        />
      </div>
      <div className="chatcal-prompt">
        <SchedulePrompt onSubmit={(text) => onSubmitPrompt(text)} targets={[]} />
      </div>
    </div>
  )
}

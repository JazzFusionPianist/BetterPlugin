import { useState, useMemo } from 'react'
import type { Profile } from '../../types/collab'
import FloatingOrbs from '../FloatingOrbs'

interface Props {
  /** Pool of people you can add — mutuals only (we don't surface
   *  one-way follows here to keep the friend graph tight). */
  friendProfiles: Profile[]
  /** Yields the new group's conversation_id on success. CollabPage
   *  uses it to route the user straight into the fresh chat. */
  onCreate: (title: string, memberIds: string[]) => Promise<string | null>
  onClose: () => void
}

const MAX_MEMBERS_INCLUDING_ME = 16

/**
 * Two-step group creation surface.
 *
 *   Step 1 — pick people (search + checkbox list, max 15 others
 *            since the caller fills the 16th slot)
 *   Step 2 — name the group, then submit
 *
 * The selection chips up top stay visible across both steps so the
 * user always knows who's going in. Step 2 is a thin layer over the
 * same chips + a name input + Create button.
 */
export default function NewGroupPanel({ friendProfiles, onCreate, onClose }: Props) {
  const [step, setStep] = useState<'pick' | 'name'>('pick')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxOthers = MAX_MEMBERS_INCLUDING_ME - 1   // caller takes one slot
  const atCap = selected.size >= maxOthers

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friendProfiles
    return friendProfiles.filter(p => p.display_name.toLowerCase().includes(q))
  }, [friendProfiles, query])

  const selectedProfiles = useMemo(
    () => friendProfiles.filter(p => selected.has(p.id)),
    [friendProfiles, selected],
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < maxOthers) next.add(id)
      return next
    })
  }

  const handleNext = () => {
    if (selected.size === 0) return
    setStep('name')
  }

  const handleCreate = async () => {
    const t = title.trim()
    if (!t || selected.size === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    const convId = await onCreate(t, Array.from(selected))
    setSubmitting(false)
    if (!convId) {
      setError('couldn\'t create the group. try again.')
      return
    }
    // CollabPage navigates on success — we just close.
    onClose()
  }

  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />

      {/* Header — back returns to the chat list */}
      <div
        className="settings-card settings-header-card"
        onClick={step === 'pick' ? onClose : () => setStep('pick')}
        role="button"
        tabIndex={0}
      >
        <span className="settings-header-back">‹</span>
        <span className="settings-header-title">
          {step === 'pick' ? 'new group' : 'name your group'}
        </span>
      </div>

      {/* Selected-people chip strip — always visible so the user knows
          who they've picked. Click a chip to drop it. */}
      {selectedProfiles.length > 0 && (
        <div className="ng-chips">
          {selectedProfiles.map(p => (
            <div
              key={p.id}
              className="ng-chip"
              onClick={() => toggle(p.id)}
              role="button"
              tabIndex={0}
              title={`remove ${p.display_name}`}
            >
              <div className="ng-chip-av" style={{ background: p.avatar_color }}>
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" />
                  : <span>{p.initials}</span>}
              </div>
              <span className="ng-chip-name">{p.display_name}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {step === 'pick' && (
        <>
          {/* Search */}
          <div className="settings-card af-search-card" style={{ marginTop: 8 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
              <circle cx="6.5" cy="6.5" r="4" />
              <path d="M10 10l3 3" strokeLinecap="round" />
            </svg>
            <input
              className="af-search-input"
              type="text"
              placeholder="search friends…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button className="af-search-clear" onClick={() => setQuery('')}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M1 1l8 8M9 1L1 9" />
                </svg>
              </button>
            )}
          </div>

          {/* Cap hint */}
          <div className="ng-cap">
            {selected.size} / {maxOthers} selected
            {atCap && <span className="ng-cap-warn"> · max reached</span>}
          </div>

          {/* Friend rows */}
          <div className="af-results ng-friend-list">
            {filtered.length === 0 && (
              <div className="settings-card af-empty">
                {query.trim() ? 'no matches' : 'no mutual friends yet'}
              </div>
            )}
            {filtered.map(p => {
              const isOn = selected.has(p.id)
              const dimmed = !isOn && atCap
              return (
                <div
                  key={p.id}
                  className={`ng-row${isOn ? ' on' : ''}${dimmed ? ' dim' : ''}`}
                  onClick={() => !dimmed && toggle(p.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="ng-row-av" style={{ background: p.avatar_color }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" />
                      : <span>{p.initials}</span>}
                    <div className={`ng-row-dot ${p.isOnline ? 'don' : 'doff'}`} />
                  </div>
                  <span className="ng-row-name">{p.display_name}</span>
                  <div className={`ng-check${isOn ? ' on' : ''}`}>
                    {isOn && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 6.5l2.5 2.5L9.5 3" />
                      </svg>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Next button — locks against zero-selection */}
          <button
            className="ng-cta"
            onClick={handleNext}
            disabled={selected.size === 0}
          >
            Next
          </button>
        </>
      )}

      {step === 'name' && (
        <>
          <div className="settings-card af-search-card" style={{ marginTop: 8 }}>
            <input
              className="af-search-input"
              type="text"
              placeholder="group name…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              maxLength={40}
            />
          </div>

          {error && <div className="ng-error">{error}</div>}

          <button
            className="ng-cta"
            onClick={handleCreate}
            disabled={!title.trim() || submitting}
          >
            {submitting ? 'creating…' : 'create group'}
          </button>
        </>
      )}
    </div>
  )
}

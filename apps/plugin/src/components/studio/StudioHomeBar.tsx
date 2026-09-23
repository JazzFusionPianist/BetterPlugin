/**
 * The home's picture — the landing's bar, with your people as the
 * notes: one whole note per friend in their colour, filled when they
 * are in the studio or online, hollow when away, all tied by one slur.
 * Touch a note and it rings and opens that person's room.
 */

import Bar from '../../slur/Bar'
import { C } from '../../slur/marks'
import type { Profile } from '../../types/collab'

const W = 1000, H = 300, Y0 = 126, GAP = 30, S = 25
const STEPS = [1, 4, 7, 2, 6, 3, 5, 4]

export default function StudioHomeBar({ friends, onlineIds, studioIds, onOpen }: {
  friends: Profile[]
  onlineIds: Set<string>
  studioIds?: Set<string>
  onOpen: (userId: string) => void
}) {
  const list = friends.slice(0, 8)
  const n = Math.max(list.length, 1)
  const xs = list.map((_, i) => (n === 1 ? W / 2 : 110 + (i * (W - 220)) / (n - 1)))
  const notes = list.map((p, i) => ({
    x: xs[i]!, step: STEPS[i % STEPS.length]!, color: p.avatar_color || C.blue,
    hollow: !(studioIds?.has(p.id) || onlineIds.has(p.id)),
  }))
  // a quiet bar when there is no one yet — three house notes
  const empty = [{ x: 260, step: 2, color: C.ink, hollow: false }, { x: 500, step: 5, color: C.orange }, { x: 740, step: 4, color: C.blue, hollow: false }]
  return (
    <div className="wd-bar">
      <Bar w={W} h={H} y0={Y0} gap={GAP} s={S} line="rgba(26,25,23,.2)" notes={list.length ? notes : empty}
        onNote={list.length ? (i) => { const p = list[i]; if (p) onOpen(p.id) } : undefined} />
      {list.length > 0 && (
        <div className="wd-bar-names">
          {list.map((p, i) => (
            <button key={p.id} className={`wd-bar-name${studioIds?.has(p.id) ? ' studio' : onlineIds.has(p.id) ? ' on' : ''}`}
              style={{ left: `${(xs[i]! / W) * 100}%` }} onClick={() => onOpen(p.id)}>
              {p.display_name}
              {studioIds?.has(p.id) && <small>in the studio</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

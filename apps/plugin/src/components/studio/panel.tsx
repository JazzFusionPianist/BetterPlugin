/**
 * The studio as a side panel — Slur DAW's right-hand column (?surface=panel).
 * It is the same studio stood on end: about 300 wide, as tall as the room.
 * There is no place for the rail beside a page, so home shows the picture,
 * the greeting and the week with the rail as a sheet under them, and a
 * page (a room, a person, games, settings) covers the whole panel with a
 * tile that leads back. The geometry lives in pages/panel.css; this file
 * holds the few things the pieces need to know.
 */

import { createContext, useContext } from 'react'

/** True inside the side panel. */
export const PanelContext = createContext(false)
export const usePanel = () => useContext(PanelContext)

/** The tile at a page's top left that leads back to where it was opened from. */
export function BackTile({ onClick, label = 'back' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="wd-back" onClick={onClick} aria-label={label} title={label}>
      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 1.5L1.8 6 6 10.5" /></svg>
    </button>
  )
}

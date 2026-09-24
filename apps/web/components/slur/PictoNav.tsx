'use client'

import { C } from './marks'

/* The pictogram nav — a small drawing, a word and two quiet lines per cell —
   the same on every page before you log in, so the pictures stay with the
   words wherever you go. `here` marks the page you are on; `onLogIn` opens
   the door in place when the page has one, otherwise the link carries it. */

type Here = 'slur' | 'patch' | 'downloads'

export default function PictoNav ({ here, onLogIn, showDownloads = true }: {
  here?: Here
  onLogIn?: () => void
  showDownloads?: boolean
}) {
  const cell = (key: Here, href: string, glyph: React.ReactNode, name: string, a: string, b: string) => (
    <a className={`sl-cell hide-narrow${here === key ? ' here' : ''}`} href={href} aria-current={here === key ? 'page' : undefined}>
      {glyph}<span><b>{name}</b><small>{a}<br />{b}</small></span>
    </a>
  )
  const door = (
    <>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M 2 29 V 1 H 16 A 13 14 0 0 1 16 29 Z" fill={C.lilac} /><circle cx="20" cy="15" r="1.8" fill={C.ink} /></svg>
      <span><b>log in</b><small>sign up<br />web</small></span>
    </>
  )
  return (
    <nav className="sl-cells">
      {cell('slur', '/downloads#slur',
        <svg width="30" height="30" viewBox="-15 -15 30 30" aria-hidden="true"><path d="M -12.98 -5.24 A 14 9.8 -22 1 0 12.98 5.24 A 14 9.8 -22 1 0 -12.98 -5.24 Z M -2.3 -5.4 A 5.9 7.3 38 1 1 2.3 5.4 A 5.9 7.3 38 1 1 -2.3 -5.4 Z" fill={C.green} fillRule="evenodd" /></svg>,
        'slur', 'the room', 'chat stems dates')}
      {cell('patch', '/downloads#patch-on-slur',
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="2" y="2" width="26" height="26" fill="#8C5A3A" /><g fill="none" stroke={C.white} strokeWidth="1.1"><circle cx="15" cy="15" r="9" /><circle cx="15" cy="15" r="5.5" /><circle cx="15" cy="15" r="2.2" /></g></svg>,
        'patch on slur', 'the wall', 'no account')}
      {showDownloads && cell('downloads', '/downloads',
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M 4 29 V 13 A 11 11 0 0 1 26 13 V 29 Z" fill="none" stroke={C.ink} strokeWidth="1.6" /><path d="M 15 11 V 22 M 10.5 17.5 L 15 22 L 19.5 17.5" fill="none" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
        'downloads', 'mac', 'au vst3 aax')}
      {onLogIn
        ? <button className="sl-cell" onClick={onLogIn}>{door}</button>
        : <a className="sl-cell" href="/?door=signin">{door}</a>}
    </nav>
  )
}

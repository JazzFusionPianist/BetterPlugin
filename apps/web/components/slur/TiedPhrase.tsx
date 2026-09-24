'use client'

import { useEffect, useRef, useState } from 'react'
import { slurPath } from './marks'

/* "tie it all together." — with an engraved slur from above the t of
   "tie" down onto the end of "together.", measured once the face has
   loaded so the tie lands on the letters and not on a fallback font. */
export default function TiedPhrase () {
  const h = useRef<HTMLHeadingElement>(null)
  const em = useRef<HTMLElement>(null)
  const [d, setD] = useState('')
  useEffect(() => {
    const draw = () => {
      if (!h.current || !em.current) return
      const box = h.current.getBoundingClientRect(), end = em.current.getBoundingClientRect()
      const fs = parseFloat(getComputedStyle(h.current).fontSize)
      setD(slurPath(fs * .1, fs * .06, end.right - box.left - fs * .07, end.top - box.top + end.height * .2, fs * .7, fs * .095))
    }
    void document.fonts.ready.then(draw)
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])
  return (
    <h2 className="sl-phrase-h" ref={h}>
      <svg className="sl-phrase-tie" aria-hidden="true">{d && <path d={d} />}</svg>
      tie it<br />all <em ref={em}>together.</em>
    </h2>
  )
}

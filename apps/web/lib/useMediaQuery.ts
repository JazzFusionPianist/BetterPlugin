'use client'

import { useEffect, useState } from 'react'

/** True while the viewport matches `query`. SSR-safe: `initial` until
 *  the client has a window (avoids a flash of the wrong shell). */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const apply = () => setMatches(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [query])
  return matches
}

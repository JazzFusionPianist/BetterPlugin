import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react'

const GameVisibility = createContext(true)
export function GameSurface({visible = true, children}: {visible?:boolean;children:ReactNode}) {
  return <GameVisibility.Provider value={visible}>{children}</GameVisibility.Provider>
}

/** Explicit dimensions avoid cyclic intrinsic/container-unit sizing in WebViews. */
export function ChessBoardFrame({children}:{children:ReactNode}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size,setSize] = useState<number|null>(null)
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const measure = () => {
      const cs = getComputedStyle(parent)
      const width = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const height = parent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const next = Math.floor(Math.min(width,height))
      if (next>0) setSize(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className="chess-board-wrap" style={size == null ? undefined : {width:size,height:size,boxSizing:'border-box'}}>{children}</div>
}

/** Hidden panes keep multiplayer subscriptions, but must not own input or solo loops. */
export function useGameActive() {
  const visible = useContext(GameVisibility)
  const [foreground, setForeground] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const update = () => setForeground(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible && foreground
}

/** Measure the pane, not the window: desktop sidebars also consume board space. */
export function useGameViewport() {
  const ref = useRef<HTMLDivElement>(null)
  const [spacious, setSpacious] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (!el.clientWidth || !el.clientHeight) return
      setSpacious(el.clientWidth >= 1000 && el.clientHeight >= 600)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return {ref, spacious}
}

/** Cache CSS colors outside the physics loop; ancestor theme changes invalidate them. */
export function useGamePalette<T>(surface:RefObject<HTMLElement|null>, read:(el:HTMLElement)=>T, initial:T) {
  const palette = useRef(initial)
  useEffect(() => {
    const el = surface.current
    if (!el) return
    const refresh = () => { palette.current = read(el) }
    refresh()
    const resize = new ResizeObserver(refresh)
    resize.observe(el)
    const theme = new MutationObserver(refresh)
    for (let parent:HTMLElement|null = el; parent; parent = parent.parentElement) {
      theme.observe(parent, {attributes:true, attributeFilter:['class','style']})
    }
    return () => { resize.disconnect(); theme.disconnect() }
  }, [surface,read])
  return palette
}

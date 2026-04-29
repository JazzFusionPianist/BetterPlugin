import { useEffect, useRef } from 'react'

interface Orb {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  el: HTMLDivElement | null
}

const DEFAULT_COLORS = [
  '#FFB4A2', '#FFCDB2', '#FFE5AB',
  '#A2D2FF', '#BDE0FE', '#C8E7FF',
  '#CDB4DB', '#E2C2FF', '#D4C5F9',
  '#B5EAEA', '#A0E7E5', '#C9E4CA',
  '#FFC8DD', '#FCD5CE', '#F7D6E0',
]

interface Props {
  count?: number
  colors?: string[]
}

/**
 * Wall-bouncing pastel orbs that fill their parent with absolute positioning.
 * GPU-composited via translate3d, drift-jittered for organic motion.
 * Drop it inside any positioned parent — it auto-sizes off the parent's bounding box.
 */
export default function FloatingOrbs({ count = 36, colors = DEFAULT_COLORS }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const orbsRef = useRef<Orb[]>([])

  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const W = rect.width
    const H = rect.height

    const orbs: Orb[] = []
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 18
      const angle = Math.random() * Math.PI * 2
      const speed = 0.08 + Math.random() * 0.18
      const orb: Orb = {
        x: r + Math.random() * (W - 2 * r),
        y: r + Math.random() * (H - 2 * r),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r,
        el: null,
      }
      const el = document.createElement('div')
      el.className = 'float-orb'
      el.style.width = `${r * 2}px`
      el.style.height = `${r * 2}px`
      el.style.background = colors[i % colors.length]
      el.style.transform = `translate3d(${orb.x - r}px, ${orb.y - r}px, 0)`
      c.appendChild(el)
      orb.el = el
      orbs.push(orb)
    }
    orbsRef.current = orbs

    let raf = 0
    const tick = () => {
      for (const o of orbsRef.current) {
        o.vx += (Math.random() - 0.5) * 0.008
        o.vy += (Math.random() - 0.5) * 0.008
        const sp = Math.hypot(o.vx, o.vy)
        const maxSp = 0.35
        const minSp = 0.08
        if (sp > maxSp) { o.vx = (o.vx / sp) * maxSp; o.vy = (o.vy / sp) * maxSp }
        else if (sp < minSp) { o.vx = (o.vx / sp) * minSp; o.vy = (o.vy / sp) * minSp }

        o.x += o.vx
        o.y += o.vy

        if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) }
        if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) }
        if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) }
        if (o.y > H - o.r) { o.y = H - o.r; o.vy = -Math.abs(o.vy) }

        if (o.el) o.el.style.transform = `translate3d(${o.x - o.r}px, ${o.y - o.r}px, 0)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      for (const o of orbsRef.current) o.el?.remove()
      orbsRef.current = []
    }
  }, [count, colors])

  return <div ref={containerRef} className="float-orbs-layer" />
}

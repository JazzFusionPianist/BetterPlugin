'use client'

import { useEffect, useRef } from 'react'

// A sparse field of tiny marginalia glyphs — asterisks, dots, small
// circles — drifting almost imperceptibly. Ink and one blue accent only;
// quiet enough to read as texture, not decoration.
const INK = '#1A1917'
const BLUE = '#2440FF'

type Kind = 'asterisk' | 'dot' | 'circle'
interface Glyph {
  x: number; y: number; vx: number; vy: number
  r: number; rot: number
  c: string; kind: Kind; alpha: number
}

export default function OrbBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let glyphs: Glyph[] = []
    let W = 0, H = 0, DPR = 1
    let raf = 0
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.width  = window.innerWidth  * DPR
      H = canvas.height = window.innerHeight * DPR
      canvas.style.width  = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
    }

    const seed = () => {
      const n = Math.max(10, Math.min(18, Math.floor(window.innerWidth / 80)))
      glyphs = []
      for (let i = 0; i < n; i++) {
        const roll = Math.random()
        const kind: Kind = roll < 0.4 ? 'asterisk' : roll < 0.75 ? 'dot' : 'circle'
        const base = kind === 'asterisk' ? 5 + Math.random() * 4
                   : kind === 'circle'   ? 6 + Math.random() * 8
                   : 1.4 + Math.random() * 1.4
        const a = Math.random() * Math.PI * 2
        const sp = (0.015 + Math.random() * 0.03) * DPR
        glyphs.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: base * DPR,
          rot: Math.random() * Math.PI,
          c: Math.random() < 0.18 ? BLUE : INK,
          kind,
          alpha: 0.1 + Math.random() * 0.1,
        })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const g of glyphs) {
        ctx.save()
        ctx.globalAlpha = g.alpha
        ctx.translate(g.x, g.y)
        ctx.rotate(g.rot)
        if (g.kind === 'dot') {
          ctx.fillStyle = g.c
          ctx.beginPath(); ctx.arc(0, 0, g.r, 0, Math.PI * 2); ctx.fill()
        } else if (g.kind === 'circle') {
          ctx.strokeStyle = g.c
          ctx.lineWidth = 1 * DPR
          ctx.beginPath(); ctx.arc(0, 0, g.r, 0, Math.PI * 2); ctx.stroke()
        } else {
          // six-spoke asterisk
          ctx.strokeStyle = g.c
          ctx.lineWidth = 1.2 * DPR
          ctx.lineCap = 'round'
          ctx.beginPath()
          for (let k = 0; k < 3; k++) {
            const a = (k / 3) * Math.PI
            ctx.moveTo(-Math.cos(a) * g.r, -Math.sin(a) * g.r)
            ctx.lineTo(Math.cos(a) * g.r, Math.sin(a) * g.r)
          }
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    const tick = () => {
      const m = 40 * DPR
      for (const g of glyphs) {
        g.x += g.vx; g.y += g.vy
        if (g.x < -m) g.x = W + m; if (g.x > W + m) g.x = -m
        if (g.y < -m) g.y = H + m; if (g.y > H + m) g.y = -m
      }
      draw()
      raf = requestAnimationFrame(tick)
    }

    const onResize = () => { resize(); seed(); if (still) draw() }
    resize(); seed()
    if (still) draw()
    else tick()
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  return <canvas ref={ref} className="orb-canvas" />
}

'use client'

import { useEffect, useRef } from 'react'

// Two layers: soft dreamy orbs (back, additive) + crisp constellations
// (front). Ported 1:1 from the landing prototype.
const COLORS = ['#FF9E7D', '#FFC24B', '#5BC0FF', '#A78BFA', '#3BD9AD', '#FF8FBE']
const STAR   = ['#FF7A59', '#FFB020', '#4EB1FF', '#9B7BFF', '#2FCFA3', '#FF5E9A']

interface Orb { x: number; y: number; vx: number; vy: number; r: number; c: string }
interface Node { dx: number; dy: number; r: number; c: string }
interface Constellation { cx: number; cy: number; vx: number; vy: number; rot: number; vr: number; nodes: Node[] }

export default function OrbBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let orbs: Orb[] = []
    let consts: Constellation[] = []
    let W = 0, H = 0, DPR = 1
    let raf = 0

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.width  = window.innerWidth  * DPR
      H = canvas.height = window.innerHeight * DPR
      canvas.style.width  = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
    }

    const seedOrbs = () => {
      const n = Math.min(14, Math.floor(window.innerWidth / 90))
      orbs = []
      for (let i = 0; i < n; i++) {
        const r = (80 + Math.random() * 180) * DPR
        const a = Math.random() * Math.PI * 2
        const sp = (0.02 + Math.random() * 0.05) * DPR
        orbs.push({ x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, c: COLORS[i % COLORS.length]! })
      }
    }

    const seedConsts = () => {
      const n = Math.max(3, Math.min(6, Math.floor(window.innerWidth / 360)))
      consts = []
      for (let i = 0; i < n; i++) {
        const count = 3 + Math.floor(Math.random() * 3)
        const spread = (38 + Math.random() * 46) * DPR
        const nodes: Node[] = []
        for (let j = 0; j < count; j++) {
          const a = (j / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7
          const d = spread * (0.55 + Math.random() * 0.45)
          nodes.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: (1.5 + Math.random() * 1.6) * DPR, c: STAR[Math.floor(Math.random() * STAR.length)]! })
        }
        const ang = Math.random() * Math.PI * 2
        const sp = (0.035 + Math.random() * 0.05) * DPR
        consts.push({ cx: Math.random() * W, cy: Math.random() * H, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.0009, nodes })
      }
    }

    const drawConsts = () => {
      const m = 220 * DPR
      for (const k of consts) {
        k.cx += k.vx; k.cy += k.vy; k.rot += k.vr
        if (k.cx < -m) k.cx = W + m; if (k.cx > W + m) k.cx = -m
        if (k.cy < -m) k.cy = H + m; if (k.cy > H + m) k.cy = -m
        const cos = Math.cos(k.rot), sin = Math.sin(k.rot)
        const pts = k.nodes.map(nd => ({ x: k.cx + nd.dx * cos - nd.dy * sin, y: k.cy + nd.dx * sin + nd.dy * cos, r: nd.r, c: nd.c }))
        ctx.strokeStyle = 'rgba(36,29,54,0.13)'
        ctx.lineWidth = 1 * DPR
        ctx.beginPath()
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i]!, b = pts[(i + 1) % pts.length]!
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
        }
        ctx.stroke()
        for (const p of pts) {
          ctx.save()
          ctx.shadowColor = p.c; ctx.shadowBlur = 6 * DPR
          ctx.fillStyle = p.c
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
          ctx.restore()
        }
      }
    }

    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      for (const o of orbs) {
        o.x += o.vx; o.y += o.vy
        if (o.x < -o.r) o.x = W + o.r; if (o.x > W + o.r) o.x = -o.r
        if (o.y < -o.r) o.y = H + o.r; if (o.y > H + o.r) o.y = -o.r
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, o.c + '30')
        g.addColorStop(1, o.c + '00')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill()
      }
      drawConsts()
      raf = requestAnimationFrame(tick)
    }

    const onResize = () => { resize(); seedOrbs(); seedConsts() }
    resize(); seedOrbs(); seedConsts(); tick()
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  return <canvas ref={ref} className="orb-canvas" />
}

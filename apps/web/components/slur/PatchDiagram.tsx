'use client'

import { useEffect, useState } from 'react'

/* Patch on Slur drawn as a diagram — the night drive patch: each print its
   family's plate in its own tint over a soft lamp, hairline audio wires with
   the signal running along them in to out, dashed hands from the controls
   and the side's key. A faint staff underneath, the house signature. */

type Fam = 'tone' | 'utility' | 'space' | 'motion' | 'pitch' | 'control' | 'spectral'
const SHAPE: Record<Fam, string> = {
  tone: 'M -1 -1 H 1 V 1 H -1 Z',
  space: 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z',
  motion: 'M -.6 -1 H 1.25 L .6 1 H -1.25 Z',
  pitch: 'M 0 -1.2 L 1.2 0 L 0 1.2 L -1.2 0 Z',
  utility: 'M -1 -.12 H 1 V .12 H -1 Z M -.12 -1 H .12 V 1 H -.12 Z',
  control: 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z M -.5 0 A .5 .5 0 1 1 .5 0 A .5 .5 0 1 1 -.5 0 Z',
  spectral: 'M -1 -1 H -.66 V 1 H -1 Z M -.4 -.5 H -.06 V 1 H -.4 Z M .2 -1 H .54 V 1 H .2 Z M .8 -.2 H 1.14 V 1 H .8 Z',
}
interface Node { x: number; y: number; f?: Fam; c?: string; r?: number; cap?: [string, string]; io?: boolean }
const P: Record<string, Node> = {
  in: { x: 44, y: 300, io: true },
  tape: { x: 130, y: 300, f: 'tone', c: '#D27A45', r: 30, cap: ['tape', 'hard 55'] },
  ms: { x: 225, y: 300, f: 'utility', c: '#FBFAF7', r: 16, cap: ['m/s', ''] },
  space: { x: 330, y: 175, f: 'space', c: '#5C80FF', r: 34, cap: ['space', 'hall 62'] },
  delay: { x: 465, y: 175, f: 'space', c: '#4AA3A0', r: 34, cap: ['delay', 'pingpong 1/8'] },
  mod: { x: 330, y: 430, f: 'motion', c: '#A7B04A', r: 30, cap: ['mod', 'phaser 45'] },
  trem: { x: 465, y: 430, f: 'motion', c: '#C2547A', r: 30, cap: ['tremolo', 'sine 1/8'] },
  voc: { x: 600, y: 430, f: 'spectral', c: '#A58BF0', r: 30, cap: ['vocode', '55'] },
  mix: { x: 640, y: 300, f: 'utility', c: '#ECE2C8', r: 20, cap: ['mix', 'blend'] },
  carve: { x: 765, y: 300, f: 'pitch', c: '#E0607E', r: 28, cap: ['carve', '-12 dB'] },
  comp: { x: 880, y: 300, f: 'tone', c: '#3FB872', r: 30, cap: ['comp', '-25 dB'] },
  air: { x: 990, y: 300, f: 'tone', c: '#B8B4AA', r: 28, cap: ['air', 'silk 50'] },
  out: { x: 1078, y: 300, io: true },
  lfo: { x: 398, y: 62, f: 'control', c: '#B79CFF', r: 20, cap: ['lfo', 'sine 1/4'] },
  macro: { x: 822, y: 70, f: 'control', c: '#F27B5A', r: 20, cap: ['macro 1', '60'] },
  side: { x: 765, y: 548, f: 'utility', c: '#5CE0A8', r: 16, cap: ['side', ''] },
}
const AUDIO: [string, string][] = [['in', 'tape'], ['tape', 'ms'], ['ms', 'space'], ['ms', 'mod'], ['space', 'delay'], ['mod', 'trem'], ['trem', 'voc'], ['delay', 'mix'], ['voc', 'mix'], ['mix', 'carve'], ['carve', 'comp'], ['comp', 'air'], ['air', 'out']]
const HANDS: [string, string][] = [['lfo', 'space'], ['lfo', 'mod'], ['macro', 'comp'], ['macro', 'delay'], ['side', 'carve'], ['side', 'voc']]

const edge = (n: Node) => (n.io ? 5 : (n.r ?? 20) * (n.f === 'motion' ? 1.25 : n.f === 'pitch' ? 1.2 : 1) + 6)
const wire = (a: Node, b: Node) => {
  const x0 = a.x + edge(a), x1 = b.x - edge(b), dx = Math.max(24, (x1 - x0) * .5)
  return `M ${x0} ${a.y} C ${x0 + dx} ${a.y}, ${x1 - dx} ${b.y}, ${x1} ${b.y}`
}

export default function PatchDiagram () {
  // the running signal is decoration: it stays still for anyone who asked for less motion
  const [still, setStill] = useState(true)
  useEffect(() => { setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])
  const nodes = Object.entries(P)
  return (
    <svg viewBox="0 0 1120 610" role="img" aria-label="Patch on Slur: a patch of fourteen prints, drawn as a diagram">
      <defs>
        {nodes.filter(([, n]) => !n.io).map(([k, n]) => (
          <radialGradient key={k} id={`pd-lamp-${k}`}><stop offset="0" stopColor={n.c} stopOpacity=".28" /><stop offset="1" stopColor={n.c} stopOpacity="0" /></radialGradient>
        ))}
      </defs>
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1={0} x2={1120} y1={260 + i * 20} y2={260 + i * 20} stroke="rgba(251,250,247,.05)" />)}
      {HANDS.map(([a, b]) => {
        const A = P[a], B = P[b]
        return <path key={a + b} d={`M ${A.x} ${A.y} Q ${(A.x + B.x) / 2 + (B.y > A.y ? 30 : -30)} ${(A.y + B.y) / 2}, ${B.x} ${B.y}`} fill="none" stroke={A.c} strokeWidth={1.1} strokeDasharray="3 5" opacity={.7} />
      })}
      {AUDIO.map(([a, b], i) => (
        <g key={a + b}>
          <path id={`pd-w${i}`} d={wire(P[a], P[b])} fill="none" stroke="rgba(251,250,247,.55)" strokeWidth={1.2} />
          {!still && (
            <circle r={2.6} fill="#FBFAF7">
              <animateMotion dur="2.2s" repeatCount="indefinite" begin={`${(i * .17).toFixed(2)}s`}><mpath href={`#pd-w${i}`} /></animateMotion>
            </circle>
          )}
        </g>
      ))}
      {nodes.map(([k, n]) => n.io ? (
        <g key={k}>
          <circle cx={n.x} cy={n.y} r={5} fill="#FBFAF7" />
          <text x={n.x} y={n.y + 24} textAnchor="middle" fontSize={12} fill="rgba(251,250,247,.45)">{k}</text>
        </g>
      ) : (
        <g key={k}>
          <g transform={`translate(${n.x} ${n.y})`}>
            <circle r={(n.r ?? 20) * 3.2} fill={`url(#pd-lamp-${k})`} />
            <path d={SHAPE[n.f!]} fill={n.c} fillRule="evenodd" transform={`scale(${n.r})`} />
          </g>
          <text x={n.x} y={n.y + (n.r ?? 20) * (n.f === 'pitch' ? 1.2 : 1) + 24} textAnchor="middle" fontSize={13.5}>
            <tspan fill="#FBFAF7" fontWeight={600}>{n.cap![0]}</tspan>
            {n.cap![1] && <tspan fill="rgba(251,250,247,.5)" dx={5}>{n.cap![1]}</tspan>}
          </text>
        </g>
      ))}
    </svg>
  )
}

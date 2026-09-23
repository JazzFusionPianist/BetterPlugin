/* A drawn picture of Patch on Slur's wall — five prints hung and wired,
   each lit by its own lamp, the signal running under them to the out.
   Not a screenshot: the prints are the plug-in's shapes, simplified. */

const W = 1200, H = 520, K = 1.35
const R = 44 * K
const MID = H * .54

type Kind = 'tone' | 'space' | 'delay' | 'mix' | 'mod'
const PRINTS: { x: number; y: number; kind: Kind; c: string; cap: string }[] = [
  { x: .18, y: .44, kind: 'tone', c: '236,226,200', cap: 'tone +24' },
  { x: .38, y: .24, kind: 'space', c: '120,150,255', cap: 'space hall 46 3.70s' },
  { x: .38, y: .7, kind: 'delay', c: '92,224,168', cap: 'delay 1/8 fb 35' },
  { x: .6, y: .45, kind: 'mix', c: '255,168,72', cap: 'mix space 62 delay 38' },
  { x: .8, y: .4, kind: 'mod', c: '220,120,200', cap: 'mod chorus 30' },
]
const P = PRINTS.map(q => ({ ...q, cx: q.x * W, cy: q.y * H }))
const LAMPS: [number, number, string][] = [[.18, .35, '236,226,200'], [.38, .2, '120,150,255'], [.38, .66, '92,224,168'], [.6, .4, '255,168,72'], [.8, .34, '220,120,200']]

const SIGNAL = (() => {
  let d = `M 0 ${MID}`
  for (let x = 0; x <= W; x += 3) {
    const k = x / W, amp = (k < .2 ? 8 : k < .6 ? 18 : 34) * K
    d += ` L ${x} ${(MID + Math.sin(x * .07) * amp * (.6 + .4 * Math.sin(x * .011)) + Math.sin(x * .27) * 3 * K).toFixed(1)}`
  }
  return d
})()

const wire = (a: typeof P[0], b: typeof P[0]) => {
  const x0 = a.cx + R + 6 * K, x1 = b.cx - R - 6 * K, dx = Math.max(30, (x1 - x0) * .5)
  return { d: `M ${x0} ${a.cy} C ${x0 + dx} ${a.cy}, ${x1 - dx} ${b.cy}, ${x1} ${b.cy}`, x0, y0: a.cy, x1, y1: b.cy }
}
const WIRES = [[0, 1, 1], [0, 2, 2], [1, 3, 1], [2, 3, 2], [3, 4, 3]].map(([a, b, c]) => ({ ...wire(P[a], P[b]), c: P[c].c }))

function Plate ({ kind, c }: { kind: Kind; c: string }) {
  const ink = `rgba(${c},.95)`
  if (kind === 'tone') return (
    <>
      <rect x={-R} y={-R} width={2 * R} height={2 * R} rx={2} fill="rgba(120,110,90,.55)" />
      <clipPath id="sl-wall-tc"><circle r={R * .78} /></clipPath>
      <g clipPath="url(#sl-wall-tc)">
        {Array.from({ length: Math.ceil(2 * R / (3.4 * K)) }, (_, i) => -R + i * 3.4 * K).map(y => <line key={y} x1={-R} x2={R} y1={y} y2={y} stroke={ink} strokeWidth={.9 * K} />)}
      </g>
    </>
  )
  if (kind === 'space') return (
    <>
      <circle r={R} fill="rgba(40,50,120,.85)" />
      {[1, 2, 3, 4].map(i => <circle key={i} r={R * (.1 + i * .12)} fill="none" stroke={ink} strokeWidth={.9 * K} opacity={1 - i * .15} />)}
      <circle r={2 * K} fill={ink} />
    </>
  )
  if (kind === 'delay') return (
    <>
      <circle r={R} fill="rgba(40,70,70,.85)" />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x={-R * .55 + i * R * .17} y={-R * .35 + i * 2 * K} width={1.6 * K} height={R * .7 - i * 4 * K} fill={ink} opacity={1 - i * .12} />)}
    </>
  )
  if (kind === 'mix') return (
    <>
      <circle r={R} fill="rgba(60,50,40,.7)" stroke="rgba(120,150,255,.9)" strokeWidth={1.4 * K} strokeDasharray={`${R * 3.9} ${R * 2.4}`} />
      {Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + (i - 2) * .38; return <line key={i} x1={0} y1={R * .35} x2={Math.cos(a) * R * .8} y2={R * .35 + Math.sin(a) * R * .9} stroke={ink} strokeWidth={.9 * K} /> })}
      {[1, 2, 3].map(i => <circle key={i} cy={R * .35} r={R * .22 * i} fill="none" stroke={ink} strokeWidth={.8 * K} opacity={.7} />)}
    </>
  )
  return (
    <>
      <path d={`M ${-R * .7} ${-R * .8} L ${R * 1.1} ${-R * .8} L ${R * .7} ${R * .8} L ${-R * 1.1} ${R * .8} Z`} fill="rgba(110,60,100,.8)" />
      {Array.from({ length: 6 }, (_, i) => {
        let w = `M ${-R * .7} ${-R * .45 + i * R * .18}`
        for (let x = -R * .7; x <= R * .7; x += 2) w += ` L ${x.toFixed(1)} ${(-R * .45 + i * R * .18 + Math.sin(x / (5 * K) + i) * 3 * K).toFixed(1)}`
        return <path key={i} d={w} fill="none" stroke={ink} strokeWidth={.9 * K} />
      })}
    </>
  )
}

export default function WallPicture ({ className }: { className?: string }) {
  const fs = 9.5 * K
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {LAMPS.map(([, , c], i) => (
          <radialGradient key={i} id={`sl-wall-l${i}`}><stop offset="0" stopColor={`rgb(${c})`} stopOpacity=".38" /><stop offset="1" stopColor={`rgb(${c})`} stopOpacity="0" /></radialGradient>
        ))}
      </defs>
      {LAMPS.map(([x, y], i) => <ellipse key={i} cx={x * W} cy={y * H + 60 * K} rx={150 * K} ry={300 * K} fill={`url(#sl-wall-l${i})`} />)}
      <path d={SIGNAL} fill="none" stroke="rgba(251,250,247,.5)" strokeWidth={1.1} />
      {WIRES.map((w, i) => (
        <g key={i}>
          <path d={w.d} fill="none" stroke={`rgba(${w.c},.7)`} strokeWidth={1.2} />
          <circle cx={w.x0} cy={w.y0} r={2.2 * K} fill="#FBFAF7" /><circle cx={w.x1} cy={w.y1} r={2.2 * K} fill="#FBFAF7" />
        </g>
      ))}
      <path d={`M ${P[4].cx + R + 6 * K} ${P[4].cy} C ${W * .9} ${P[4].cy}, ${W * .9} ${MID}, ${W * .95 - 6} ${MID}`} fill="none" stroke="rgba(220,120,200,.7)" strokeWidth={1.2} />
      <circle cx={W * .95} cy={MID} r={4 * K} fill="#FBFAF7" />
      <text x={W * .95} y={MID + 18 * K} fill="rgba(251,250,247,.6)" fontSize={9 * K} textAnchor="middle">out</text>
      {P.map((q, i) => {
        const [w0, ...rest] = q.cap.split(' ')
        const cw = q.cap.length * fs * .52 + 10 * K
        return (
          <g key={i}>
            <g transform={`translate(${q.cx} ${q.cy})`}><Plate kind={q.kind} c={q.c} /></g>
            <rect x={q.cx - cw / 2} y={q.cy + R + 18 * K - fs - 1 * K} width={cw} height={fs + 6 * K} rx={2} fill="rgba(15,14,13,.78)" />
            <text x={q.cx} y={q.cy + R + 18 * K} textAnchor="middle" fill="#FBFAF7" fontSize={fs}>
              <tspan fontWeight={600}>{w0} </tspan><tspan fill="rgba(251,250,247,.6)">{rest.join(' ')}</tspan>
            </text>
          </g>
        )
      })}
    </svg>
  )
}

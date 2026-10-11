import { BREATH_ARM, BREATH_STUDIO, BREATH_STUDIO_VIEWBOX, BREATH_VIEWBOX, BREATH_WORD, C, nibOffsets } from './marks'

const NIB = nibOffsets()

/** The Slur Studio mark: "slur" written in one broad-nib stroke, the r's
    arm returning over the word in the arm colour. Width follows height.
    With `studio` the second word follows in the same hand: the daw's name. */
export default function SlurMark ({ height = 40, ink = C.ink, arm = C.blue, className, title, studio = false }: {
  height?: number
  ink?: string
  arm?: string
  className?: string
  title?: string
  studio?: boolean
}) {
  const stroke = (d: string, color: string) => (
    <g fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      {NIB.map(([x, y], i) => <path key={i} d={d} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} />)}
    </g>
  )
  return (
    <svg className={className} viewBox={studio ? BREATH_STUDIO_VIEWBOX : BREATH_VIEWBOX} height={height} width={Math.round(height * (studio ? 506 : 210) / 150)}
      role="img" aria-label={title ?? (studio ? 'slur studio' : 'slur')} style={{ display: 'block', overflow: 'visible' }}>
      {stroke(BREATH_WORD, ink)}
      {stroke(BREATH_ARM, arm)}
      {studio && <g transform="translate(200 0)">{BREATH_STUDIO.map((d, i) => <g key={i}>{stroke(d, ink)}</g>)}</g>}
    </svg>
  )
}

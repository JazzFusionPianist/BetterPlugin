/**
 * Orb chess set — minimal, geometric, drawn for the catalogue.
 * White pieces: paper fill + ink line. Black pieces: solid ink.
 * One component, no external assets (works offline in the PWA).
 */

const INK = '#1A1917'
const PAPER = '#FBFAF7'

type Glyph = {
  paths: string[]
  balls?: [number, number, number][]
  lines?: [number, number, number, number][]
  /** Details drawn in the CONTRASTING colour (eye, mitre slit) so they
   *  read on both the paper and the ink piece. [kind, ...geometry] */
  contrast?: (['dot', number, number, number] | ['line', number, number, number, number])[]
}

// All in a 45×45 box, baseline at y≈38.
const GLYPHS: Record<string, Glyph> = {
  P: {
    paths: [
      'M22.5 9.5 a4.6 4.6 0 1 1 -0.01 0 Z',
      'M17.6 33.5 C17.6 26.5 19.2 22.6 22.5 20.6 C25.8 22.6 27.4 26.5 27.4 33.5 Z',
    ],
    lines: [[14.5, 37.2, 30.5, 37.2]],
  },
  R: {
    paths: [
      'M14.5 15.5 V9 h4.4 v3.4 h3.4 V9 h0.4 h3 v3.4 h3.4 V9 h4.4 v6.5 l-2 2 l-0.8 12.5 H17.3 L16.5 17.5 Z',
    ],
    lines: [[14, 33.6, 31, 33.6], [13.5, 37.2, 31.5, 37.2]],
  },
  N: {
    paths: [
      // Horse facing left: chest → ear (two-tip) → forehead → muzzle
      // notch → jaw → neck.
      'M31 34 C31 25.5 30 20 25.5 17.6 L26.5 9.8 L21.6 14.6 C16.6 15.4 13.4 19.4 13.2 24.2 L18.4 25.6 C18.9 24 20 22.9 21.6 22.4 L16.8 34 Z',
    ],
    contrast: [['dot', 22.6, 18.6, 1.15]],
    lines: [[13.5, 37.2, 31.5, 37.2]],
  },
  B: {
    paths: [
      'M22.5 5.2 a1.8 1.8 0 1 1 -0.01 0 Z',
      'M22.5 10.4 C27 14 29.2 18.8 27.6 23.8 C26.6 27.2 24.8 29 22.5 29 C20.2 29 18.4 27.2 17.4 23.8 C15.8 18.8 18 14 22.5 10.4 Z',
    ],
    contrast: [['line', 21.4, 15.2, 24.9, 19.6]],
    lines: [[15.5, 33.6, 29.5, 33.6], [14, 37.2, 31, 37.2]],
  },
  Q: {
    paths: [
      'M14 19 L16.8 11.4 L20.6 17 L22.5 10 L24.4 17 L28.2 11.4 L31 19 C29.8 26 29 29.5 28.6 33 H16.4 C16 29.5 15.2 26 14 19 Z',
    ],
    balls: [[16.6, 9.6, 1.7], [22.5, 8, 1.7], [28.4, 9.6, 1.7]],
    lines: [[13.5, 37.2, 31.5, 37.2]],
  },
  K: {
    paths: [
      'M16 33 C14.2 25 16.8 18.4 22.5 16.4 C28.2 18.4 30.8 25 29 33 Z',
    ],
    lines: [[22.5, 5.5, 22.5, 13], [19.3, 8.6, 25.7, 8.6], [13.5, 37.2, 31.5, 37.2]],
  },
}

export function PieceGlyph({ piece, size }: { piece: string; size?: number | string }) {
  const white = piece.startsWith('w')
  const g = GLYPHS[piece[1] ?? 'P'] ?? GLYPHS.P
  const fill = white ? PAPER : INK
  const contrast = white ? INK : PAPER
  const stroke = INK
  return (
    <svg
      viewBox="0 0 45 45"
      width={size ?? '100%'}
      height={size ?? '100%'}
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {g.paths.map((d, i) => (
        <path key={i} d={d} fill={fill} stroke={stroke} strokeWidth={1.7}
          strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {g.balls?.map(([cx, cy, r], i) => (
        <circle key={`b${i}`} cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
      ))}
      {g.lines?.map(([x1, y1, x2, y2], i) => (
        <line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke} strokeWidth={2.6} strokeLinecap="round" />
      ))}
      {g.contrast?.map((d, i) =>
        d[0] === 'dot' ? (
          <circle key={`c${i}`} cx={d[1]} cy={d[2]} r={d[3]} fill={contrast} />
        ) : (
          <line key={`c${i}`} x1={d[1]} y1={d[2]} x2={d[3]} y2={d[4]}
            stroke={contrast} strokeWidth={1.8} strokeLinecap="round" />
        ),
      )}
    </svg>
  )
}

export const PIECE_LABELS: Record<string, string> = {
  wK: 'White King', wQ: 'White Queen', wR: 'White Rook',
  wB: 'White Bishop', wN: 'White Knight', wP: 'White Pawn',
  bK: 'Black King', bQ: 'Black Queen', bR: 'Black Rook',
  bB: 'Black Bishop', bN: 'Black Knight', bP: 'Black Pawn',
}

/**
 * Beat → seconds conversion for project files that store arrangement time in
 * quarter-note beats. Points hold their BPM until the next point, or ramp
 * linearly in BPM over beats (Ableton/DAWproject "linear"), integrated exactly.
 */
export interface TempoPoint { beat: number; bpm: number; ramp: boolean }
export interface TempoMap { points: TempoPoint[]; constant: boolean }

export function tempoMap(points: TempoPoint[]): TempoMap {
  const sorted = points.filter(p => Number.isFinite(p.beat) && Number.isFinite(p.bpm))
    .sort((a, b) => a.beat - b.beat)
  if (!sorted.length || sorted.some(p => !(p.bpm >= 1 && p.bpm <= 1000))) throw new Error('Unsupported project tempo.')
  // Collapse duplicates at one beat (last wins, as hosts do).
  const unique = sorted.filter((p, i) => i === sorted.length - 1 || sorted[i + 1].beat !== p.beat)
  return { points: unique, constant: unique.every(p => p.bpm === unique[0].bpm) }
}

function span(fromBeat: number, toBeat: number, startBpm: number, endBpm: number, segmentBeats: number, segmentStartBeat: number) {
  // Seconds between two beats inside one segment whose BPM moves linearly.
  const at = (b: number) => segmentBeats > 0 ? startBpm + (endBpm - startBpm) * (b - segmentStartBeat) / segmentBeats : startBpm
  const a = at(fromBeat), b = at(toBeat)
  if (Math.abs(b - a) < 1e-12) return 60 * (toBeat - fromBeat) / a
  return 60 * (toBeat - fromBeat) / (b - a) * Math.log(b / a)
}

export function beatsToSeconds(map: TempoMap, beat: number): number {
  if (!Number.isFinite(beat)) throw new Error('Invalid beat position.')
  const p = map.points
  // Before the first point the first tempo holds (also covers negative beats).
  if (map.constant || beat <= p[0].beat) return 60 * beat / p[0].bpm
  let seconds = 60 * p[0].beat / p[0].bpm
  for (let i = 0; i < p.length; i++) {
    const cur = p[i], next = p[i + 1]
    const end = next ? Math.min(beat, next.beat) : beat
    const endBpm = next && cur.ramp ? next.bpm : cur.bpm
    const length = next ? next.beat - cur.beat : 0
    seconds += span(cur.beat, end, cur.bpm, endBpm, length, cur.beat)
    if (!next || beat <= next.beat) return seconds
  }
  return seconds
}

/** Seconds per beat at a beat; used to check whether warped audio plays at unity rate. */
export function secondsPerBeatAt(map: TempoMap, beat: number): number {
  const p = map.points
  let i = 0
  while (i + 1 < p.length && p[i + 1].beat <= beat) i++
  const cur = p[i], next = p[i + 1]
  if (!next || !cur.ramp || beat < cur.beat) return 60 / cur.bpm
  return 60 / (cur.bpm + (next.bpm - cur.bpm) * (beat - cur.beat) / (next.beat - cur.beat))
}

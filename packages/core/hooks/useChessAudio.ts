import { useCallback, useEffect, useRef, useState } from 'react'

const sample = new URL('../assets/chess-piece-place.mp3', import.meta.url).href
const preference = 'slur.chess3d.sound'

export function useChessAudio() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(preference) === 'on' } catch { return false }
  })
  const state = useRef<{ context: AudioContext; buffer?: AudioBuffer; load: Promise<void>; sources: Set<AudioBufferSourceNode> } | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const prepare = useCallback(() => {
    if (state.current) return state.current
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const context = new Ctor()
      const entry = { context, buffer: undefined as AudioBuffer | undefined, load: Promise.resolve(), sources: new Set<AudioBufferSourceNode>() }
      entry.load = fetch(sample).then(response => {
        if (!response.ok) throw new Error('Chess audio unavailable')
        return response.arrayBuffer()
      }).then(bytes => context.decodeAudioData(bytes)).then(buffer => { entry.buffer = buffer }).catch(() => {})
      state.current = entry
      return entry
    } catch { return null }
  }, [])
  const unlock = useCallback(() => {
    if (enabledRef.current) void prepare()?.context.resume().catch(() => {})
  }, [prepare])
  useEffect(() => {
    if (enabled) prepare()
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [enabled, prepare, unlock])
  useEffect(() => () => {
    if (state.current) { void state.current.context.close().catch(() => {}); state.current = null }
  }, [])
  const toggle = useCallback(() => {
    const next = !enabledRef.current
    enabledRef.current = next
    setEnabled(next)
    try { localStorage.setItem(preference, next ? 'on' : 'off') } catch {}
    if (next) void prepare()?.context.resume().catch(() => {})
    else state.current?.sources.forEach(source => { try { source.stop() } catch {} })
  }, [prepare])
  const play = useCallback(() => {
    const entry = state.current
    if (!enabledRef.current || !entry?.buffer || entry.context.state !== 'running') return
    const source = entry.context.createBufferSource()
    const gain = entry.context.createGain()
    source.buffer = entry.buffer
    gain.gain.value = .45
    source.connect(gain); gain.connect(entry.context.destination)
    entry.sources.add(source)
    source.onended = () => { entry.sources.delete(source); source.disconnect(); gain.disconnect() }
    source.start()
  }, [])
  const stop = useCallback(() => {
    state.current?.sources.forEach(source => { try { source.stop() } catch {} })
  }, [])
  return { enabled, toggle, unlock, play, stop }
}

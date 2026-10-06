import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { CircleCheck, Download, LoaderCircle } from 'lucide-react'
import { useAudioDownloads } from '../../lib/audioDownloads'
import { audioFileTransfers, type AudioFileTrack, type AudioFileTransfer } from '@orb/core/lib/regionAudioFiles.ts'
import { downloadAudioTransfer } from '../../lib/regionAudioDownloads'
import { audioDownloadCache } from '../../lib/audioDownloadCache'
import { callJuceNative, hasJuceNativeFunction } from '../../lib/juceBridge'
import './audioTransfer.css'

/** Downloading bytes never initiates a DAW drag. Both controls read the
 * same URL-keyed cache, including downloads started by a different row. */
export default function AudioTransferActions({ tracks, groupKey, batch = false, className = '' }: {
  tracks: AudioFileTrack[]
  groupKey: string
  batch?: boolean
  className?: string
}) {
  const cache = useAudioDownloads()
  let files: AudioFileTransfer[] = [], manifestError = ''
  try { files = audioFileTransfers(tracks) } catch (e) { manifestError = String(e) }
  const readyCount = files.filter(file => cache.peek(file.key)).length
  const ready = files.length > 0 && readyCount === files.length
  const pending = files.some(file => cache.progress(file.key))
  const [busy, setBusy] = useState(false), [arming, setArming] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true), armed = useRef(false), running = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fn = batch || files.length > 1 ? 'writeAudioFiles' : 'writeAudioFile'
  const canDrag = hasJuceNativeFunction(fn)
  useEffect(() => {
    mounted.current = true
    const disarm = () => { armed.current = false }
    const otherArmed = (event: Event) => {
      if ((event as CustomEvent<{ url: string }>).detail?.url !== groupKey) disarm()
    }
    window.addEventListener('__localDragArmed', otherArmed)
    window.addEventListener('__juceImported', disarm)
    window.addEventListener('__juceOutDragCancel', disarm)
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener('__localDragArmed', otherArmed)
      window.removeEventListener('__juceImported', disarm)
      window.removeEventListener('__juceOutDragCancel', disarm)
    }
  }, [groupKey])

  const download = async () => {
    if (running.current || ready) return
    running.current = true; setBusy(true); setError('')
    const scope = cache.scope()
    let failed = 0
    for (const file of files) {
      if (!mounted.current || cache.scope() !== scope) break
      try { await downloadAudioTransfer(file) } catch { failed++ }
    }
    if (mounted.current) {
      if (failed) setError(`${failed} ${failed === 1 ? 'download failed' : 'downloads failed'}. Click to retry missing tracks.`)
      setBusy(false)
    }
    running.current = false
  }
  const drag = async (event: MouseEvent) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    if (!ready || !canDrag || arming || armed.current) return
    // Re-read the cache: eviction/sign-out must never cause an implicit download.
    const entries = files.map(file => ({ ...file, audio: audioDownloadCache.peek(file.key) }))
    if (entries.some(entry => !entry.audio)) return
    setArming(true); setError('')
    try {
      if (entries.length > 32) throw new Error('Drag up to 32 audio files at a time.')
      const result = await callJuceNative(fn, entries.flatMap(entry => [entry.audio!.base64, entry.name]), 120_000)
      if (!mounted.current) return
      if (result !== 'armed') throw new Error('Could not prepare the drag. Try again.')
      window.dispatchEvent(new CustomEvent('__localDragArmed', { detail: { url: groupKey } }))
      armed.current = true
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { armed.current = false }, 15_000)
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not prepare the drag.') }
    finally { if (mounted.current) setArming(false) }
  }

  const downloading = busy || pending
  const label = ready ? (batch ? 'All tracks downloaded' : 'Downloaded')
    : downloading ? (batch ? `Downloading ${readyCount}/${files.length}` : 'Downloading')
    : batch ? `Download all (${readyCount}/${files.length} ready)` : 'Download'
  return <span className={`audio-transfer-actions ${className}`}>
    <button type="button" className={`audio-download${ready ? ' complete' : ''}`}
      disabled={ready || busy || !!manifestError || !files.length} aria-label={label} title={error || manifestError || label}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); void download() }}>
      {ready ? <CircleCheck size={16} aria-hidden="true" /> : downloading
        ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
    </button>
    <button type="button" className="audio-drag" disabled={!ready || !canDrag || arming}
      title={!ready ? 'Download first, then drag into your DAW' : !canDrag ? 'Open Slur in your DAW to drag audio' : 'Drag into your DAW; this does not automatically restore its position'}
      onMouseDown={event => { void drag(event) }} onClick={event => event.stopPropagation()}>
      {arming ? 'Preparing drag…' : batch ? 'Drag all to DAW' : 'Drag to DAW'}
    </button>
    {(error || manifestError) && <span className="audio-transfer-error" role="alert">{error || manifestError}</span>}
  </span>
}

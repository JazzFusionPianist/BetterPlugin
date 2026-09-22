import { useEffect, useId, useRef, useState } from 'react'
import { ListMusic, RefreshCw, X } from 'lucide-react'
import { hasTrackExport, useTrackExportHost, exportDawTracks, inspectDawTracks, type TrackExportSnapshot } from '../../lib/dawTrackExport'
import { useT } from '../../i18n/LanguageContext'
import './trackExport.css'

const time = (samples: number, rate: number) => {
  const seconds = Math.abs(samples / rate)
  return `${samples < 0 ? '−' : ''}${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, '0')}`
}

export default function ExportTracksButton({ onCapture, className }: {
  onCapture: (file: File) => Promise<void>; className?: string
}) {
  const { t } = useT(), host = useTrackExportHost()
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null), mounted = useRef(true), running = useRef(false)
  const [snapshot, setSnapshot] = useState<TrackExportSnapshot | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [mode, setMode] = useState<'entire' | 'selection'>('entire')
  const [busy, setBusy] = useState<'loading' | 'exporting' | 'uploading' | null>(null)
  const [error, setError] = useState('')
  const archive = useRef<File | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  if (!hasTrackExport() || !host.proTools) return null
  const refresh = async () => {
    if (running.current) return
    running.current = true; setBusy('loading'); setError(''); archive.current = null
    try {
      const next = await inspectDawTracks()
      if (!mounted.current) return
      setSnapshot(next)
      setSelected(next.tracks.filter(track => track.selected && !track.disabledReason).map(track => track.id))
      setMode(next.ranges.entire ? 'entire' : 'selection')
    } catch (e) { if (mounted.current) { setSnapshot(null); setError(e instanceof Error ? e.message : String(e)) } }
    finally { running.current = false; if (mounted.current) setBusy(null) }
  }
  const exportTracks = async () => {
    if (running.current || !snapshot || !selected.length) return
    running.current = true; setBusy('exporting'); setError('')
    try {
      archive.current ??= await exportDawTracks(snapshot, selected, mode)
      // A conversation switch unmounts this keyed component. Never send into the new chat.
      if (!mounted.current) return
      setBusy('uploading')
      await onCapture(archive.current)
      if (mounted.current) { archive.current = null; dialog.current?.close() }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)) }
    finally { running.current = false; if (mounted.current) setBusy(null) }
  }
  const range = snapshot?.ranges[mode]
  return <>
    <button type="button" className={className} onClick={() => { dialog.current?.showModal(); void refresh() }}
      title={t('trackExport.title')} aria-label={t('trackExport.title')}><ListMusic size={16} /></button>
    <dialog ref={dialog} className="slur-track-export" aria-labelledby={`${id}-title`}
      onCancel={e => { if (running.current) e.preventDefault() }}>
      <header><div><h2 id={`${id}-title`}>{t('trackExport.title')}</h2><p>Pro Tools{snapshot ? ` · ${snapshot.name}` : ''}</p></div>
        <button type="button" disabled={!!busy} onClick={() => dialog.current?.close()} aria-label={t('common.close')}><X size={18} /></button></header>
      <div className="slur-track-export-body">
        <div className="slur-track-export-toolbar"><span>{t('trackExport.choose')}</span>
          <button type="button" disabled={!!busy} onClick={() => void refresh()}><RefreshCw size={13} /> {t('trackExport.refresh')}</button></div>
        <div className="slur-track-export-list">
          {snapshot?.tracks.map(track => <label key={track.id} title={track.disabledReason ?? track.name}>
            <input type="checkbox" disabled={!!busy || !!track.disabledReason} checked={selected.includes(track.id)}
              onChange={e => { archive.current = null; setSelected(old => e.target.checked ? [...old, track.id] : old.filter(id => id !== track.id)) }} />
            <span><strong>{track.name}</strong><small>{track.disabledReason ?? track.type}</small></span>
          </label>)}
          {!busy && snapshot?.tracks.length === 0 && <p>{t('trackExport.empty')}</p>}
        </div>
        <fieldset disabled={!!busy}><legend>{t('trackExport.range')}</legend>
          <label><input type="radio" name={`${id}-range`} checked={mode === 'entire'} disabled={!snapshot?.ranges.entire}
            onChange={() => { archive.current = null; setMode('entire') }} />{t('trackExport.entire')}</label>
          <label><input type="radio" name={`${id}-range`} checked={mode === 'selection'} disabled={!snapshot?.ranges.selection}
            onChange={() => { archive.current = null; setMode('selection') }} />{t('trackExport.selection')}</label>
        </fieldset>
        {range && snapshot && <p className="slur-track-export-time">{time(range.start, snapshot.sampleRate)} → {time(range.end, snapshot.sampleRate)}
          <span>{time(range.end - range.start, snapshot.sampleRate)} · {snapshot.sampleRate / 1000}k</span></p>}
        <p className="slur-track-export-help">{mode === 'entire' ? t('trackExport.bounds') : t('trackExport.selectionHelp')}</p>
        {snapshot?.entireError && <p className="slur-track-export-help">{snapshot.entireError}</p>}
        <p className="slur-track-export-help">{t('trackExport.routing')}</p>
        {error && <p role="alert" className="slur-track-export-error">{error}</p>}
      </div>
      <footer><span role="status" aria-live="polite">{busy ? t(`trackExport.${busy}`) : t('trackExport.count', { count: selected.length })}</span>
        <button type="button" className="slur-track-export-submit" disabled={!!busy || !selected.length || !range}
          onClick={() => void exportTracks()}>{t('trackExport.submit')}</button></footer>
    </dialog>
  </>
}

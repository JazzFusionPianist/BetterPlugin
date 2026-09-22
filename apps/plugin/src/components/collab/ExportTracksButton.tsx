import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, ListMusic, LoaderCircle, RefreshCw, Search, X } from 'lucide-react'
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
  const [query, setQuery] = useState('')
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
  const visibleTracks = snapshot?.tracks.filter(track => track.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? []
  const selectableIds = visibleTracks.filter(track => !track.disabledReason).map(track => track.id)
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every(id => selected.includes(id))
  const toggleVisible = () => {
    archive.current = null
    setSelected(old => allVisibleSelected ? old.filter(id => !selectableIds.includes(id)) : [...new Set([...old, ...selectableIds])])
  }
  return <>
    <button type="button" className={className} onClick={() => { setQuery(''); dialog.current?.showModal(); void refresh() }}
      title={t('trackExport.title')} aria-label={t('trackExport.title')}><ListMusic size={16} /></button>
    <dialog ref={dialog} className="slur-track-export" aria-labelledby={`${id}-title`}
      onCancel={e => { if (running.current) e.preventDefault() }}>
      <header>
        <div className="slur-track-export-mark"><ListMusic size={21} aria-hidden="true" /></div>
        <div className="slur-track-export-heading"><h2 id={`${id}-title`}>{t('trackExport.title')}</h2>
          <p title={snapshot?.name}><span>Pro Tools</span>{snapshot ? ` / ${snapshot.name}` : ''}</p></div>
        <button type="button" className="slur-track-export-icon" disabled={!!busy} onClick={() => dialog.current?.close()} aria-label={t('common.close')}><X size={18} /></button>
      </header>
      <div className="slur-track-export-body">
        <div className="slur-track-export-toolbar">
          <label className="slur-track-export-search"><Search size={16} aria-hidden="true" />
            <input type="search" value={query} disabled={!!busy} onChange={e => setQuery(e.target.value)}
              placeholder={t('trackExport.search')} aria-label={t('trackExport.search')} />
          </label>
          <button type="button" className="slur-track-export-icon" disabled={!!busy} onClick={() => void refresh()}
            title={t('trackExport.refresh')} aria-label={t('trackExport.refresh')}><RefreshCw size={16} className={busy === 'loading' ? 'slur-track-export-spin' : ''} /></button>
        </div>
        <div className="slur-track-export-list-heading">
          <span id={`${id}-tracks`}>{t('trackExport.choose')} <span className="slur-track-export-total">{visibleTracks.length}</span></span>
          <button type="button" disabled={!!busy || !selectableIds.length} onClick={toggleVisible}>
            {t(allVisibleSelected ? (query.trim() ? 'trackExport.clearResults' : 'trackExport.clearAll') : (query.trim() ? 'trackExport.selectResults' : 'trackExport.selectAll'))}
          </button>
        </div>
        <div className="slur-track-export-list" role="group" aria-labelledby={`${id}-tracks`} aria-busy={busy === 'loading'}>
          {busy !== 'loading' && visibleTracks.map(track => <label className="slur-track-export-row" key={track.id} title={track.disabledReason ?? track.name}>
            <input type="checkbox" disabled={!!busy || !!track.disabledReason} checked={selected.includes(track.id)} aria-description={track.disabledReason ?? undefined}
              onChange={e => { archive.current = null; setSelected(old => e.target.checked ? [...old, track.id] : old.filter(id => id !== track.id)) }} />
            <span className="slur-track-export-name">{track.name}</span><span className="slur-track-export-type">{track.disabledReason ? t('trackExport.unavailable') : track.type}</span>
          </label>)}
          {busy === 'loading' && <div className="slur-track-export-placeholder"><LoaderCircle size={22} className="slur-track-export-spin" /><p>{t('trackExport.loading')}</p></div>}
          {!busy && snapshot && visibleTracks.length === 0 && <div className="slur-track-export-placeholder"><ListMusic size={24} /><p>{t(snapshot.tracks.length ? 'trackExport.noResults' : 'trackExport.empty')}</p></div>}
        </div>
        <div className="slur-track-export-settings">
          <fieldset disabled={!!busy}><legend>{t('trackExport.range')}</legend>
            <div className="slur-track-export-segments">
              <label><input type="radio" name={`${id}-range`} checked={mode === 'entire'} disabled={!snapshot?.ranges.entire}
                onChange={() => { archive.current = null; setMode('entire') }} /><span>{t('trackExport.entire')}</span></label>
              <label><input type="radio" name={`${id}-range`} checked={mode === 'selection'} disabled={!snapshot?.ranges.selection}
                onChange={() => { archive.current = null; setMode('selection') }} /><span>{t('trackExport.selection')}</span></label>
            </div>
          </fieldset>
          {range && snapshot && <p className="slur-track-export-time"><span>{time(range.start, snapshot.sampleRate)} <span aria-hidden="true">→</span> {time(range.end, snapshot.sampleRate)}</span>
            <span className="slur-track-export-duration">{time(range.end - range.start, snapshot.sampleRate)} · {snapshot.sampleRate / 1000} kHz</span></p>}
          {snapshot?.entireError && <p className="slur-track-export-warning">{snapshot.entireError}</p>}
          <details className="slur-track-export-details"><summary>{t('trackExport.details')}<ChevronDown size={13} aria-hidden="true" /></summary>
            <div><p>{mode === 'entire' ? t('trackExport.bounds') : t('trackExport.selectionHelp')}</p><p>{t('trackExport.routing')}</p></div>
          </details>
        </div>
        {error && <p role="alert" className="slur-track-export-error">{error}</p>}
      </div>
      <footer><span className="slur-track-export-status" role="status" aria-live="polite">
        {busy ? <><LoaderCircle size={15} className="slur-track-export-spin" />{t(`trackExport.${busy}`)}</> : <>{t('trackExport.count', { count: selected.length })}{selected.length > 0 && <button type="button" onClick={() => { archive.current = null; setSelected([]) }}>{t('trackExport.clearAll')}</button>}</>}
      </span>
        <button type="button" className="slur-track-export-submit" disabled={!!busy || !selected.length || !range}
          onClick={() => void exportTracks()}>{t('trackExport.submit')}<ArrowUpRight size={16} aria-hidden="true" /></button></footer>
    </dialog>
  </>
}

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, ListMusic, LoaderCircle, RefreshCw, Search, X } from 'lucide-react'
import { hasTrackExport, useTrackExportHost, exportDawTracks, inspectDawTracks, inspectDawTrackRange, stemStatus, tapCoverage, type TrackExportSnapshot, type TrackRoute } from '../../lib/dawTrackExport'
import { ROUTE_LABELS } from '@orb/core/lib/stemRoutes.ts'
import TapGuide from './TapGuide'
import { useT } from '../../i18n/LanguageContext'
import './trackExport.css'

const time = (samples: number, rate: number) => {
  const seconds = Math.abs(samples / rate)
  return `${samples < 0 ? '−' : ''}${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, '0')}`
}

export default function ExportTracksButton({ onCapture, className }: {
  onCapture: (file: File, projectName: string) => Promise<void>; className?: string
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
  const [elapsed, setElapsed] = useState(0)
  const [open, setOpen] = useState(false), [rangeWarning, setRangeWarning] = useState('')
  const rangePoll = useRef<Promise<void> | null>(null)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const [chosenRoute, setChosenRoute] = useState<TrackRoute | null>(null)
  const route: TrackRoute | undefined = chosenRoute && host.routes.includes(chosenRoute) ? chosenRoute : host.routes[0]
  const daw = route === 'tap' ? `${host.name} · Slur Tap` : route ? ROUTE_LABELS[route] : host.name
  const [blocked, setBlocked] = useState<'tap' | 'reaper' | null>(null)
  const archive = useRef<File | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const start = Date.now(), timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busy])
  useEffect(() => {
    if (!open || busy || !snapshot?.sessionId) return
    let active = true, timer: number
    const poll = () => {
      if (!active) return
      if (running.current || rangePoll.current || !snapshotRef.current) { timer = window.setTimeout(poll, 1000); return }
      const before = snapshotRef.current
      rangePoll.current = inspectDawTrackRange(before).then(next => {
        if (!active || running.current) return
        setRangeWarning('')
        const oldRange = before.ranges.selection, newRange = next.ranges.selection
        if (oldRange?.start !== newRange?.start || oldRange?.end !== newRange?.end) {
          if (mode === 'selection') archive.current = null
          snapshotRef.current = next; setSnapshot(next)
        }
      }).catch(e => { if (active && !running.current) setRangeWarning(String(e instanceof Error ? e.message : e)) })
        .finally(() => { rangePoll.current = null; if (active) timer = window.setTimeout(poll, 1000) })
    }
    timer = window.setTimeout(poll, 1000)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, busy, snapshot?.sessionId, mode])
  if (!hasTrackExport() || !host.supported) return null
  const refresh = async (target = route) => {
    if (running.current) return
    if (!host.supported || !target) {
      setSnapshot(null); setSelected([]); setError(t('trackExport.unsupported', { daw: host.name || 'DAW' })); return
    }
    running.current = true; setBusy('loading'); setError(''); setRangeWarning(''); setBlocked(null); archive.current = null
    try {
      await rangePoll.current
      if (target !== 'ptsl') {
        // Explain the missing piece instead of failing: no Slur Tap yet, or REAPER bridge not running.
        const status = await stemStatus().catch(() => null)
        if (status && target === 'tap' && status.taps === 0) { setSnapshot(null); setBlocked('tap'); return }
        if (status && target === 'reaper' && !status.reaper.connected) { setSnapshot(null); setBlocked('reaper'); return }
      }
      const next = await inspectDawTracks(target)
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
      await rangePoll.current
      const current = !archive.current && mode === 'selection' ? await inspectDawTrackRange(snapshot) : snapshot
      if (mounted.current) { snapshotRef.current = current; setSnapshot(current) }
      archive.current ??= await exportDawTracks(current, selected, mode)
      // A conversation switch unmounts this keyed component. Never send into the new chat.
      if (!mounted.current) return
      setBusy('uploading')
      await onCapture(archive.current, snapshot.name)
      if (mounted.current) { archive.current = null; dialog.current?.close() }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)) }
    finally { running.current = false; if (mounted.current) setBusy(null) }
  }
  const range = snapshot?.ranges[mode]
  // Slur Tap rows: is the chosen range captured, and how old is the capture?
  const tapNote = (track: TrackExportSnapshot['tracks'][number]) => {
    if (route !== 'tap' || !range || range.start === undefined) return null
    const c = tapCoverage(track.spans, range.start, range.end)
    if (!c.complete) return t('stems.notCaptured')
    const minutes = c.oldestMs ? Math.round((Date.now() - c.oldestMs) / 60000) : 0
    return t('stems.captured', { when: minutes < 1 ? t('stems.justNow') : `${minutes} min` })
  }
  const visibleTracks = snapshot?.tracks.filter(track => track.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? []
  const selectableIds = visibleTracks.filter(track => !track.disabledReason).map(track => track.id)
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every(id => selected.includes(id))
  const toggleVisible = () => {
    archive.current = null
    setSelected(old => allVisibleSelected ? old.filter(id => !selectableIds.includes(id)) : [...new Set([...old, ...selectableIds])])
  }
  return <>
    <button type="button" className={className} onClick={() => { setQuery(''); setOpen(true); dialog.current?.showModal(); void refresh() }}
      title={t('trackExport.title')} aria-label={t('trackExport.title')}><ListMusic size={16} /></button>
    <dialog ref={dialog} className="slur-track-export" aria-labelledby={`${id}-title`}
      onClose={() => setOpen(false)}
      onCancel={e => { if (running.current) e.preventDefault() }}>
      <header>
        <div className="slur-track-export-mark"><ListMusic size={21} aria-hidden="true" /></div>
        <div className="slur-track-export-heading"><h2 id={`${id}-title`}>{t('trackExport.title')}</h2>
          <p title={snapshot?.name}><span>{daw}</span>{snapshot ? ` / ${snapshot.name}` : ''}</p></div>
        <button type="button" className="slur-track-export-icon" disabled={!!busy} onClick={() => dialog.current?.close()} aria-label={t('common.close')}><X size={18} /></button>
      </header>
      <div className="slur-track-export-body">
        <div className="slur-track-export-toolbar">
          {host.routes.length > 1 && <select className="slur-track-export-daw" value={route} disabled={!!busy}
            aria-label={t('trackExport.daw')} onChange={e => {
              const next = e.target.value as TrackRoute
              setChosenRoute(next); setSnapshot(null); setSelected([]); setQuery(''); void refresh(next)
            }}>{host.routes.map(r => <option key={r} value={r}>{ROUTE_LABELS[r]}</option>)}</select>}
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
        {blocked === 'tap' && <TapGuide host={host.name} purpose="tracks" busy={!!busy} onRefresh={() => void refresh('tap')} />}
        {blocked === 'reaper' && <div className="slur-track-export-guide"><h3>{t('stems.reaperTitle')}</h3><p>{t('stems.reaperHelp')}</p>
          <button type="button" className="slur-track-export-secondary" disabled={!!busy} onClick={() => void refresh('reaper')}><RefreshCw size={15} />{t('trackExport.refresh')}</button></div>}
        {!blocked && <div className="slur-track-export-list" role="group" aria-labelledby={`${id}-tracks`} aria-busy={busy === 'loading'}>
          {busy !== 'loading' && visibleTracks.map(track => <label className="slur-track-export-row" key={track.id} title={track.disabledReason ?? track.name}>
            <input type="checkbox" disabled={!!busy || !!track.disabledReason} checked={selected.includes(track.id)} aria-description={track.disabledReason ?? undefined}
              onChange={e => { archive.current = null; setSelected(old => e.target.checked ? [...old, track.id] : old.filter(id => id !== track.id)) }} />
            <span className="slur-track-export-name">{track.name}</span><span className="slur-track-export-type">{track.disabledReason ? t('trackExport.unavailable') : tapNote(track) ?? track.type}</span>
          </label>)}
          {busy === 'loading' && <div className="slur-track-export-placeholder"><LoaderCircle size={22} className="slur-track-export-spin" /><p>{t('trackExport.loading', { daw })}</p></div>}
          {!busy && snapshot && visibleTracks.length === 0 && <div className="slur-track-export-placeholder"><ListMusic size={24} /><p>{t(snapshot.tracks.length ? 'trackExport.noResults' : 'trackExport.empty')}</p></div>}
        </div>}
        <div className="slur-track-export-settings">
          <fieldset disabled={!!busy}><legend>{t('trackExport.range')}</legend>
            <div className="slur-track-export-segments">
              <label><input type="radio" name={`${id}-range`} checked={mode === 'entire'} disabled={!snapshot?.ranges.entire}
                onChange={() => { archive.current = null; setMode('entire') }} /><span>{t('trackExport.entire')}</span></label>
              <label title={snapshot?.rangeNote}><input type="radio" name={`${id}-range`} checked={mode === 'selection'} disabled={!snapshot?.ranges.selection}
                onChange={() => { archive.current = null; setMode('selection') }} /><span>{t(route === 'tap' ? 'stems.loopRange' : route === 'reaper' ? 'stems.timeSelection' : 'trackExport.selection')}</span></label>
            </div>
          </fieldset>
          {range?.nativeLabel && <p className="slur-track-export-time">{t('trackExport.nativeRange')}</p>}
          {range && !range.nativeLabel && range.start !== undefined && snapshot?.sampleRate && <p className="slur-track-export-time"><span>{time(range.start, snapshot.sampleRate)} <span aria-hidden="true">→</span> {time(range.end, snapshot.sampleRate)}</span>
            <span className="slur-track-export-duration">{time(range.end - range.start, snapshot.sampleRate)} · {snapshot.sampleRate / 1000} kHz</span></p>}
          {snapshot?.entireError && <p className="slur-track-export-warning">{snapshot.entireError}</p>}
          {open && !busy && snapshot && <p className="slur-track-export-warning" role="status">{rangeWarning || (route === 'tap' ? snapshot.rangeNote : t('stems.rangeLive', { daw: route === 'reaper' ? 'REAPER' : 'Pro Tools' }))}</p>}
          <details className="slur-track-export-details"><summary>{t('trackExport.details')}<ChevronDown size={13} aria-hidden="true" /></summary>
            <div><p>{route === 'tap' ? t('stems.tapBounds') : route === 'reaper' ? t('stems.reaperBounds') : mode === 'entire' ? t('trackExport.bounds') : t('trackExport.selectionHelp')}</p><p>{t(route === 'tap' ? 'stems.tapRouting' : 'trackExport.routing')}</p></div>
          </details>
        </div>
        {error && <p role="alert" className="slur-track-export-error">{error}</p>}
        {busy === 'exporting' && elapsed >= 90 && <p role="status" className="slur-track-export-warning">
          Waiting for {route === 'reaper' ? 'REAPER' : route === 'tap' ? 'Slur Tap' : 'Pro Tools'} ({Math.floor(elapsed / 60)}m {elapsed % 60}s). If its render window is stuck, cancel there first.
          Slur will not start another render or switch to real-time playback automatically.
        </p>}
      </div>
      <footer><span className="slur-track-export-status" role="status" aria-live="polite">
        {busy ? <><LoaderCircle size={15} className="slur-track-export-spin" />{t(`trackExport.${busy}`, { daw })}</> : <>{t('trackExport.count', { count: selected.length })}{selected.length > 0 && <button type="button" onClick={() => { archive.current = null; setSelected([]) }}>{t('trackExport.clearAll')}</button>}</>}
      </span>
        <button type="button" className="slur-track-export-submit" disabled={!!busy || !selected.length || !range}
          onClick={() => void exportTracks()}>{archive.current && !busy ? 'Retry upload' : t('trackExport.submit')}<ArrowUpRight size={16} aria-hidden="true" /></button></footer>
    </dialog>
  </>
}

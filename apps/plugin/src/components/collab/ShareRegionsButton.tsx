import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Layers, X, RefreshCw, FolderOpen, Link2, LoaderCircle } from 'lucide-react'
import { useRegionHost, inspectRegions, captureRegions, linkedProject, suggestProjects, linkSuggestedProject, chooseProject,
  type RegionRoute, type RegionSnapshot, type LinkedProject, type ProjectSuggestion } from '../../lib/dawRegions'
import { stemStatus } from '../../lib/dawTrackExport'
import { ROUTE_LABELS, savedFileIsLive } from '@orb/core/lib/stemRoutes.ts'
import { useT } from '../../i18n/LanguageContext'
import TapGuide from './TapGuide'
import './trackExport.css'

const clock = (s = 0) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`
const ago = (ms: number) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000))
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(ms).toLocaleDateString()
}

/** Region sharing: each region's original audio plus its own timeline position.
 * Sources, best first: host data (LUNA, REAPER), the saved project file, Slur Tap. */
export default function ShareRegionsButton({ onCapture, className }: { onCapture: (file: File) => Promise<void>; className?: string }) {
  const { t } = useT(), host = useRegionHost(), id = useId(), dialog = useRef<HTMLDialogElement>(null)
  const mounted = useRef(true), running = useRef(false)
  const [route, setRoute] = useState<RegionRoute | null>(null)
  const [snapshot, setSnapshot] = useState<RegionSnapshot | null>(null), [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [query, setQuery] = useState('')
  const [project, setProject] = useState<LinkedProject | null>(null), [suggestions, setSuggestions] = useState<ProjectSuggestion[] | null>(null)
  const [blocked, setBlocked] = useState<'tap' | 'reaper' | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function guard<T>(work: () => Promise<T>) {
    if (running.current) return
    running.current = true; setBusy(true); setError('')
    try { return await work() } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)) }
    finally { running.current = false; if (mounted.current) setBusy(false) }
  }
  const load = (next: RegionRoute) => guard(async () => {
    setRoute(next); setSnapshot(null); setSelected([]); setBlocked(null); setSuggestions(null)
    if (next === 'project') {
      const linked = await linkedProject()
      if (!mounted.current) return
      setProject(linked)
      if (!linked?.exists) { setSuggestions(await suggestProjects()); return }
    }
    if (next === 'tap' || next === 'reaper') {
      const status = await stemStatus().catch(() => null)
      if (next === 'tap' && status && status.taps === 0) { setBlocked('tap'); return }
      if (next === 'reaper' && status && !status.reaper.connected) { setBlocked('reaper'); return }
    }
    const s = await inspectRegions(next)
    if (mounted.current) setSnapshot(s)
  })
  const link = async (pick: () => Promise<LinkedProject | null>) => {
    const linked = await guard(pick)
    if (!mounted.current || linked === undefined) return
    setProject(linked)
    if (linked?.exists) await load('project')
  }
  async function share() {
    if (!snapshot || !selected.length) return
    await guard(async () => {
      const archive = await captureRegions(snapshot, selected)
      if (!mounted.current) return
      await onCapture(archive)
      if (mounted.current) dialog.current?.close()
    })
  }

  const groups = useMemo(() => {
    const q = query.toLocaleLowerCase()
    const rows = snapshot?.regions.filter(r => `${r.name} ${r.trackName}`.toLocaleLowerCase().includes(q)) ?? []
    const map = new Map<string, { name: string; rows: typeof rows }>()
    for (const r of rows) { const g = map.get(r.trackId) ?? { name: r.trackName, rows: [] }; g.rows.push(r); map.set(r.trackId, g) }
    return [...map.entries()]
  }, [snapshot, query])
  if (!host.routes.length) return null
  const visible = groups.flatMap(([, g]) => g.rows)
  const pickable = (rows: typeof visible) => rows.filter(r => !r.disabledReason).map(r => r.id)
  const toggleAll = (ids: string[], on: boolean) => setSelected(old => on ? [...new Set([...old, ...ids])] : old.filter(x => !ids.includes(x)))
  const notes = new Set(snapshot?.regions.filter(r => selected.includes(r.id)).flatMap(r => r.notes ?? []))
  const kind = project?.kind

  return <>
    <button type="button" className={className} title={t('regions.title')} aria-label={t('regions.title')}
      onClick={() => { setQuery(''); dialog.current?.showModal(); void load(route && host.routes.includes(route) ? route : host.routes[0]) }}><Layers size={16} /></button>
    <dialog ref={dialog} className="slur-track-export" aria-labelledby={`${id}-title`} onCancel={e => { if (running.current) e.preventDefault() }}>
      <header>
        <div className="slur-track-export-mark"><Layers size={21} aria-hidden="true" /></div>
        <div className="slur-track-export-heading"><h2 id={`${id}-title`}>{t('regions.title')}</h2>
          <p><span>{host.host}</span>{snapshot ? ` / ${snapshot.name}` : ''}</p></div>
        <button type="button" className="slur-track-export-icon" disabled={busy} onClick={() => dialog.current?.close()} aria-label={t('common.close')}><X size={18} /></button>
      </header>
      <div className="slur-track-export-body">
        {host.routes.length > 1 && <div className="slur-route-tabs" role="tablist" aria-label={t('regions.source')}>
          {host.routes.map(r => <button key={r} type="button" role="tab" aria-selected={route === r} disabled={busy}
            onClick={() => void load(r)}>{ROUTE_LABELS[r]}</button>)}
        </div>}

        {route === 'project' && project?.exists && <div className="slur-project-link">
          <Link2 size={15} aria-hidden="true" />
          <span className="slur-project-name" title={project.path}>{project.name}</span>
          <span className="slur-project-age">{t('regions.saved', { when: ago(project.modifiedMs) })}</span>
          <button type="button" disabled={busy} onClick={() => void link(chooseProject)}>{t('regions.change')}</button>
        </div>}
        {route === 'project' && project?.exists && <p className="slur-track-export-warning">
          {kind && !savedFileIsLive(kind) ? t('regions.dawprojectHint') : t('regions.saveHint')}</p>}

        {route === 'project' && suggestions && <div className="slur-track-export-guide">
          <h3>{t('regions.linkTitle')}</h3>
          <p>{host.kinds.includes('dawproject') && !host.kinds.some(k => k !== 'dawproject') ? t('regions.linkDawproject') : t('regions.linkHelp')}</p>
          <div className="slur-track-export-list">
            {suggestions.map(s => <button key={s.index} type="button" className="slur-track-export-row slur-project-pick" disabled={busy}
              onClick={() => void link(() => linkSuggestedProject(s.index))}>
              <span className="slur-track-export-name">{s.name}<small> · {s.folder}</small></span>
              <span className="slur-track-export-type">{ago(s.modifiedMs)}</span></button>)}
            {!suggestions.length && <p className="slur-track-export-placeholder">{t('regions.noProjects')}</p>}
          </div>
          <button type="button" className="slur-track-export-secondary" disabled={busy} onClick={() => void link(chooseProject)}>
            <FolderOpen size={15} aria-hidden="true" />{t('regions.chooseFile')}</button>
        </div>}

        {blocked === 'tap' && <TapGuide host={host.host} purpose="regions" onRefresh={() => void load('tap')} busy={busy} />}
        {blocked === 'reaper' && <div className="slur-track-export-guide"><h3>{t('stems.reaperTitle')}</h3><p>{t('stems.reaperHelp')}</p>
          <button type="button" className="slur-track-export-secondary" disabled={busy} onClick={() => void load('reaper')}><RefreshCw size={15} />{t('trackExport.refresh')}</button></div>}

        {snapshot && <>
          <div className="slur-track-export-toolbar"><label className="slur-track-export-search">
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('regions.search')} aria-label={t('regions.search')} /></label>
            <button type="button" className="slur-track-export-icon" disabled={busy} onClick={() => void load(snapshot.route)} aria-label={t('trackExport.refresh')}><RefreshCw size={16} /></button></div>
          <div className="slur-track-export-list-heading"><span>{t('regions.count', { count: visible.length })}</span>
            <span><button type="button" disabled={busy} onClick={() => toggleAll(pickable(visible), true)}>{t('trackExport.selectAll')}</button>
              <button type="button" disabled={busy} onClick={() => setSelected([])}>{t('trackExport.clearAll')}</button></span></div>
          <div className="slur-track-export-list" aria-busy={busy}>
            {groups.map(([trackId, g]) => {
              const ids = pickable(g.rows), all = ids.length > 0 && ids.every(x => selected.includes(x))
              return <div key={trackId} role="group" aria-label={g.name}>
                <label className="slur-track-export-row slur-track-export-group">
                  <input type="checkbox" disabled={busy || !ids.length} checked={all} onChange={e => toggleAll(ids, e.target.checked)} />
                  <span className="slur-track-export-name">{g.name}</span><span className="slur-track-export-type">{t('regions.count', { count: g.rows.length })}</span>
                </label>
                {g.rows.map(r => <label key={r.id} className="slur-track-export-row slur-track-export-child" title={r.disabledReason ?? r.name}>
                  <input type="checkbox" disabled={busy || !!r.disabledReason} checked={selected.includes(r.id)}
                    onChange={e => toggleAll([r.id], e.target.checked)} />
                  <span className="slur-track-export-name">{r.name}{r.notes?.filter(n => n !== 'processed').map(n => <small key={n} className="slur-track-export-note">{t(`regions.note.${n}` as 'regions.note.gain')}</small>)}</span>
                  <span className="slur-track-export-type">{r.disabledReason ? t('trackExport.unavailable') : `${clock(r.start)} · ${(r.length ?? 0).toFixed(2)}s`}</span>
                </label>)}
              </div>
            })}
            {!visible.length && <p className="slur-track-export-placeholder">{busy ? <LoaderCircle size={18} className="slur-track-export-spin" /> : t('regions.empty')}</p>}
          </div>
          <p className="slur-track-export-warning">{snapshot.route === 'tap' ? t('regions.tapHelp') : t('regions.help')}
            {notes.size > 0 && ` ${t('regions.notesApplied')}`}</p>
        </>}
        {busy && !snapshot && !suggestions && !blocked && <div className="slur-track-export-placeholder"><LoaderCircle size={22} className="slur-track-export-spin" /></div>}
        {error && <p role="alert" className="slur-track-export-error">{error}</p>}
      </div>
      <footer><span className="slur-track-export-status">{t('trackExport.count', { count: selected.length })}</span>
        <button type="button" className="slur-track-export-submit" disabled={busy || !selected.length || !snapshot} onClick={() => void share()}>
          {busy && snapshot ? t('regions.sharing') : t('regions.submit', { count: selected.length })}</button></footer>
    </dialog>
  </>
}

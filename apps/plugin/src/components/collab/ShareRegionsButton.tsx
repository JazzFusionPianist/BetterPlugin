import { useEffect, useId, useRef, useState } from 'react'
import { Layers, X, RefreshCw } from 'lucide-react'
import { useLunaRegionTransfer, inspectLunaRegions, captureLunaRegions, type LunaRegionSnapshot } from '../../lib/lunaRegions'
import './trackExport.css'

export default function ShareRegionsButton({ onCapture, className }: { onCapture: (file: File) => Promise<void>; className?: string }) {
  const supported = useLunaRegionTransfer(), id = useId(), dialog = useRef<HTMLDialogElement>(null)
  const mounted = useRef(true), running = useRef(false)
  const [snapshot, setSnapshot] = useState<LunaRegionSnapshot | null>(null), [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [query, setQuery] = useState('')
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function refresh() {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setSnapshot(null); setSelected([])
    try { const s = await inspectLunaRegions(); if (mounted.current) setSnapshot(s) }
    catch (e) { if (mounted.current) setError(String(e)) }
    finally { running.current = false; if (mounted.current) setBusy(false) }
  }
  async function share() {
    if (running.current || !snapshot || !selected.length) return
    running.current = true; setBusy(true); setError('')
    try {
      const archive = await captureLunaRegions(snapshot, selected)
      if (!mounted.current) return
      await onCapture(archive)
      if (mounted.current) dialog.current?.close()
    } catch (e) { if (mounted.current) setError(String(e)) }
    finally { running.current = false; if (mounted.current) setBusy(false) }
  }
  if (!supported) return null
  const visible = snapshot?.regions.filter(r => `${r.name} ${r.trackName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? []
  return <>
    <button type="button" className={className} title="Share audio regions from LUNA" aria-label="Share audio regions from LUNA"
      onClick={() => { dialog.current?.showModal(); void refresh() }}><Layers size={16} /></button>
    <dialog ref={dialog} className="slur-track-export" aria-labelledby={`${id}-title`} onCancel={e => { if (running.current) e.preventDefault() }}>
      <header><div className="slur-track-export-heading"><h2 id={`${id}-title`}>Share regions</h2><p>LUNA{snapshot ? ` / ${snapshot.name}` : ''}</p></div>
        <button type="button" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Close"><X size={18} /></button></header>
      <div className="slur-track-export-body">
        <div className="slur-track-export-toolbar"><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find region or track" aria-label="Find region or track" />
          <button type="button" disabled={busy} onClick={() => void refresh()} aria-label="Refresh regions"><RefreshCw size={16} /></button></div>
        <div className="slur-track-export-list-heading"><span>{visible.length} regions</span><button type="button" disabled={busy}
          onClick={() => setSelected(visible.filter(r => !r.disabledReason).map(r => r.id))}>Select visible</button>
          <button type="button" disabled={busy} onClick={() => setSelected([])}>Clear</button></div>
        <div className="slur-track-export-list" aria-busy={busy}>
          {visible.map(r => <label key={r.id} className="slur-track-export-row" title={r.disabledReason ?? `${r.trackName} — ${r.name}`}>
            <input type="checkbox" disabled={busy || !!r.disabledReason} checked={selected.includes(r.id)}
              onChange={e => setSelected(old => e.target.checked ? [...old, r.id] : old.filter(x => x !== r.id))} />
            <span className="slur-track-export-name">{r.name}<small> · {r.trackName}</small></span>
            <span className="slur-track-export-type">{r.disabledReason ? 'Unavailable' : `${((r.start ?? 0) / (r.sampleRate || 1)).toFixed(3)}s`}</span>
          </label>)}
          {!visible.length && <p className="slur-track-export-placeholder">{busy ? 'Reading LUNA…' : 'No audio regions'}</p>}
        </div>
        <p className="slur-track-export-warning">Shares selected region audio and edited positions. Track effects are not rendered. Edited fades, gain, loops and time stretching are not yet supported.</p>
        {error && <p role="alert">{error}</p>}
      </div>
      <footer><span>{selected.length} selected</span><button type="button" disabled={busy || !selected.length} onClick={() => void share()}>{busy ? 'Working…' : `Share ${selected.length} regions`}</button></footer>
    </dialog>
  </>
}

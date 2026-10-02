import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Download, FolderInput } from 'lucide-react'
import { hasCompleteLayout, readBundleAttachment, type BundleAudioEntry } from '../../lib/regionBundle'
import { downloadRegionBundle } from '../../lib/regionBundleIO'
import { useT } from '../../i18n/LanguageContext'
import { hasRegionBridge, importRegionSelection, exportLogicSelection, useRegionHost } from '../../lib/dawRegionBridge'
import './regionBundle.css'

export default function RegionBundleAttachment({ value, renderAudio }: {
  value: unknown; renderAudio?: (entry: BundleAudioEntry) => ReactNode
}) {
  const parsed = readBundleAttachment(value)
  const { t } = useT()
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imported, setImported] = useState(false)
  const host = useRegionHost()
  const download = useRef<AbortController | null>(null)
  useEffect(() => () => download.current?.abort(), [])
  if (!parsed) return <div className="region-bundle" role="alert">{t('bundle.invalid')}</div>
  const { bundle, entries } = parsed
  const complete = hasCompleteLayout(bundle)
  const groups = [
    ...bundle.tracks.slice().sort((a, b) => a.order - b.order).map(track => ({
      id: track.id, name: track.name, regions: bundle.regions.filter(r => r.trackId === track.id),
    })),
    { id: 'unassigned', name: t('bundle.unassigned'), regions: bundle.regions.filter(r => r.trackId === null) },
  ].filter(g => g.regions.length)

  const save = async (logicAAF = false) => {
    if (download.current) return
    const controller = new AbortController()
    download.current = controller
    setBusy(true); setError('')
    try {
      if (logicAAF) {
        await exportLogicSelection(entries, controller.signal)
        return
      }
      const blob = await downloadRegionBundle(entries, controller.signal)
      controller.signal.throwIfAborted()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `Orb-${bundle.id}.orb-regions.zip`
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t('bundle.failed'))
    } finally {
      download.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const restore = async () => {
    if (download.current || imported) return
    const controller = new AbortController()
    download.current = controller
    setBusy(true); setError('')
    try {
      await importRegionSelection(entries, controller.signal)
      if (!controller.signal.aborted) setImported(true)
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t('bundle.failed'))
    } finally {
      download.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <section className="region-bundle" aria-label={t('bundle.title')}>
    <header>
      <button className="region-bundle-summary" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        <strong>{t('bundle.title')}</strong>
        <span>{bundle.regions.length} {t('bundle.regions')}{bundle.tracks.length > 0 ? ` / ${bundle.tracks.length} ${t('bundle.tracks')}` : ''}</span>
      </button>
      <button className="region-bundle-download" title={t('bundle.download')} aria-label={t('bundle.download')}
        disabled={busy} onClick={() => void save()}>{busy ? '...' : <Download size={18} />}</button>
      {complete && hasRegionBridge() && host.logic && <button className="region-bundle-download"
        title={t('bundle.exportLogic')} aria-label={t('bundle.exportLogic')} disabled={busy}
        onClick={() => void save(true)}><FolderInput size={18} /></button>}
      {complete && hasRegionBridge() && host.proTools && <button className="region-bundle-download"
        title={t('bundle.importProTools')} aria-label={t('bundle.importProTools')} disabled={busy || imported}
        onClick={() => void restore()}><FolderInput size={18} /></button>}
    </header>
    <p className="region-bundle-status">{imported ? t('bundle.imported') : complete
      ? host.logic ? t('bundle.logicPlacementUnavailable')
        : hasRegionBridge() ? t('bundle.layoutPreserved') : t('bundle.adapterRequired') : t('bundle.layoutMissing')}</p>
    {expanded && <div className="region-bundle-groups">{groups.map(g => <div key={g.id}>
      <h4>{g.name}</h4>
      <ul>{g.regions.map(r => <li key={r.id}><span>{r.name}</span><small>{r.start
        ? `${(r.start.samples / r.start.sampleRate).toFixed(3)} s` : t('bundle.positionUnknown')}</small></li>)}</ul>
    </div>)}</div>}
    {expanded && renderAudio && <div className="region-bundle-audio">{entries.map(entry =>
      <div key={entry.assetId}>{renderAudio(entry)}</div>)}</div>}
    {error && <p role="alert" className="region-bundle-error">{error}</p>}
  </section>
}

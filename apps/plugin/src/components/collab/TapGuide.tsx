import { RefreshCw } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'

/** Shown only when the host offers no satellite-free route and no Slur Tap is loaded yet. */
export default function TapGuide({ host, purpose, onRefresh, busy }: {
  host: string; purpose: 'tracks' | 'regions'; onRefresh: () => void; busy: boolean
}) {
  const { t } = useT()
  return <div className="slur-track-export-guide">
    <h3>{t('stems.tapTitle', { daw: host || 'DAW' })}</h3>
    <p>{t(purpose === 'tracks' ? 'stems.tapWhyTracks' : 'stems.tapWhyRegions', { daw: host || 'DAW' })}</p>
    <ol>
      <li>{t('stems.tapStep1')}</li>
      <li>{t('stems.tapStep2')}</li>
      <li>{t('stems.tapStep3')}</li>
    </ol>
    <p className="slur-track-export-warning">{t('stems.tapTip')}</p>
    <button type="button" className="slur-track-export-secondary" disabled={busy} onClick={onRefresh}>
      <RefreshCw size={15} aria-hidden="true" />{t('trackExport.refresh')}</button>
  </div>
}

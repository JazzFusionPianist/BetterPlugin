import { useEffect, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { captureRegionSelection, hasRegionBridge, useRegionHost } from '../../lib/dawRegionBridge'
import { useT } from '../../i18n/LanguageContext'

export default function CaptureRegionsButton({ onCapture, onError, className }: {
  onCapture: (file: File) => Promise<void>; onError: (error: string) => void; className?: string
}) {
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const mounted = useRef(true)
  const { t } = useT()
  const host = useRegionHost()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  if (!hasRegionBridge() || !host.proTools || host.logic) return null
  const capture = async () => {
    if (running.current) return
    running.current = true; setBusy(true)
    try {
      const file = await captureRegionSelection()
      if (mounted.current) await onCapture(file)
    } catch (error) {
      if (mounted.current) onError(error instanceof Error ? error.message : t('bundle.failed'))
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return <button type="button" className={className} disabled={busy} onClick={() => void capture()}
    aria-label={t('bundle.capture')} title={t('bundle.capture')}>
    {busy ? '...' : <Layers size={16} />}
  </button>
}

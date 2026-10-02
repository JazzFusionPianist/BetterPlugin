import { useEffect, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { captureRegionSelection, hasRegionBridge, useRegionHost } from '../../lib/dawRegionBridge'
import { useT } from '../../i18n/LanguageContext'

export default function CaptureRegionsButton({ onCapture, onError, className, logicOnly = false }: {
  onCapture: (file: File) => Promise<void>; onError: (error: string) => void; className?: string; logicOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const mounted = useRef(true)
  const { t } = useT()
  const host = useRegionHost()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  if (!hasRegionBridge() || (!host.proTools && !host.logic) || (logicOnly && !host.logic)) return null
  const capture = async () => {
    if (running.current) return
    running.current = true; setBusy(true)
    try {
      const file = await captureRegionSelection(host.logic)
      if (mounted.current) await onCapture(file)
    } catch (error) {
      if (mounted.current) onError(error instanceof Error ? error.message : t('bundle.failed'))
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return <button type="button" className={className} disabled={busy} onClick={() => void capture()}
    aria-label={t(host.logic ? 'bundle.captureLogic' : 'bundle.capture')} title={t(host.logic ? 'bundle.captureLogic' : 'bundle.capture')}>
    {busy ? '...' : <Layers size={16} />}
  </button>
}

// Synthetic native bridge: never connects to a real DAW, server or conversation.
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import ExportTracksButton from '../src/components/collab/ExportTracksButton'
import { LanguageProvider } from '../src/i18n/LanguageContext'
const callbacks = new Set<(data: unknown) => void>()
let selection = { start: 48000, end: 144000 }, liveCalls = 0, bounceCalls = 0, sentStart = 0
window.__JUCE__ = {
  initialisationData: { __juce__platform: ['mac'], __juce__functions: ['trackExportHost', 'trackExportCapabilities', 'trackExport'] },
  backend: {
    addEventListener(_event, callback) { callbacks.add(callback) },
    removeEventListener(_event, callback) { callbacks.delete(callback) },
    emitEvent(_event, data) {
      const req = data as { name: string; params: string[]; resultId: number }
      let result = ''
      if (req.name === 'trackExportHost') result = 'Pro Tools'
      else if (req.name === 'trackExportCapabilities') result = JSON.stringify({ adapters: ['Pro Tools'] })
      else if (req.params[0] === 'inspectTracks') result = JSON.stringify({ ok: true, sessionId: 'qa', name: 'Synthetic session', sampleRate: 48000,
        tracks: [{ id: 'drums', name: 'Drum Bus', type: 'RoutingFolder', selected: true, disabledReason: null }],
        ranges: { entire: { start: 0, end: 480000 }, selection }, entireError: '' })
      else if (req.params[0] === 'inspectTrackRange') { liveCalls++; result = JSON.stringify({ ok: true, sessionId: 'qa', sampleRate: 48000, selection }) }
      else { bounceCalls++; sentStart = JSON.parse(req.params[2]).start; result = JSON.stringify({ ok: true, data: 'cWE=' }) }
      queueMicrotask(() => callbacks.forEach(cb => cb({ promiseId: req.resultId, result })))
    },
  },
}
function Fixture() {
  const [result, setResult] = useState(''), [failed, setFailed] = useState(false)
  return <LanguageProvider><main style={{ fontFamily: 'Arial', padding: 24 }}>
    <h1>Live selection QA (mock DAW)</h1>
    <p>A simulated grid selection changes while the dialog stays open.</p>
    <button onClick={() => { window.setTimeout(() => { selection = { start: 3125017, end: 6755989 } }, 2500) }}>Change simulated selection in 2.5s</button>
    <button onClick={() => setResult(`Polls ${liveCalls}; bounces ${bounceCalls}; start ${sentStart}`)}>Read counters</button>
    <p>{result}</p>
    <ExportTracksButton onCapture={async () => {
      if (!failed) { setFailed(true); throw new Error('Synthetic upload failure — retry upload') }
      setResult(`Uploaded; bounces ${bounceCalls}; start ${sentStart}`)
    }} />
  </main></LanguageProvider>
}
const root = createRoot(document.getElementById('root')!)
root.render(<Fixture />)
if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); callbacks.clear() })

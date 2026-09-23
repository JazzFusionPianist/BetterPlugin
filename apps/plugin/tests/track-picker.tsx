// Development-only Vite fixture. Not an application route or production build entry.
// Open /tests/track-picker.html; ?case=empty|error|loading|midi exercises other states.
// No Pro Tools commands, accounts, uploads, or network credentials are used.
import { createRoot } from 'react-dom/client'
import ExportTracksButton from '../src/components/collab/ExportTracksButton'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import '../src/index.css'
import '../src/pages/studio.css'
import '../src/pages/collab.css'

const variant = new URLSearchParams(location.search).get('case')
const listeners = new Set<(data: unknown) => void>()
const names = ['Kick In', 'Kick Out', 'Snare Top', 'Snare Bottom', 'Hi-Hat', 'Rack Tom', 'Floor Tom', 'Overheads L', 'Overheads R', 'Room Close', 'Room Far', 'Bass DI', 'Bass Amp', 'Piano', 'Rhodes', 'Guitar Clean', 'Guitar Drive', 'Guitar Double', 'Lead Vocal', 'Lead Vocal', 'Vocal Double', 'Harmony High', 'Harmony Low', 'Strings', 'Pad — Midnight Harbour / extended stereo texture', 'Percussion', 'Tambourine', 'Shaker', 'FX Return', 'Drums Bus', 'Music Bus', 'Master']
window.__JUCE__ = {
  initialisationData: { __juce__functions: ['trackExportHost', 'trackExportCapabilities', 'trackExport'], __juce__platform: ['mac'] },
  backend: {
    addEventListener: (_, fn) => { listeners.add(fn) },
    removeEventListener: (_, fn) => { listeners.delete(fn) },
    emitEvent: (_, value) => {
      const { name, params, resultId } = value as { name: string; params: string[]; resultId: number }
      if (name === 'trackExport' && variant === 'loading') return
      const luna = params[0] === 'inspectLunaTracks'
      const result = name === 'trackExportHost' ? 'Standalone' : name === 'trackExportCapabilities' ? JSON.stringify({ adapters: ['Pro Tools', 'LUNA'] }) : JSON.stringify(
        !['inspectTracks', 'inspectLunaTracks'].includes(params[0]) ? { ok: false, error: 'QA only: no audio was exported or sent.' }
        : variant === 'error' ? { ok: false, error: 'QA: Pro Tools is not running. Open a session and refresh.' }
        : { ok: true, sessionId: 'qa', name: 'Midnight Harbour — Full Band', sampleRate: 48000,
          tracks: variant === 'empty' ? [] : names.map((name, i) => ({ id: String(i), name, type: i > 28 ? 'Aux' : 'Audio', selected: i < 3, disabledReason: i === 31 ? 'Master tracks cannot be bounced independently.' : null })),
          ranges: { entire: variant === 'midi' ? null : { start: 0, end: 9600000 }, selection: luna ? null : { start: 48000, end: 480000 } },
          rangeNote: luna ? 'Entire session only.' : '',
          entireError: variant === 'midi' ? 'MIDI content requires an explicit timeline range. Select the full song in Pro Tools and refresh.' : '',
        })
      setTimeout(() => listeners.forEach(fn => fn({ promiseId: resultId, result })), 100)
    },
  },
}
createRoot(document.getElementById('root')!).render(
  <LanguageProvider><div className="wd"><div className="wd-main"><div className="wd-input">
    <ExportTracksButton className="wd-gameinv" onCapture={async () => { throw new Error('QA fixture never uploads.') }} />
  </div></div></div></LanguageProvider>,
)

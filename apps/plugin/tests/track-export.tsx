import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { LanguageProvider, useT } from '../src/i18n/LanguageContext'
import ExportTracksButton from '../src/components/collab/ExportTracksButton'
import { prepareRegionTransfer } from '../src/lib/regionBundleIO'

// Native-only test surface: real DAW export, local validation, no network upload.
function Harness() {
  const [result, setResult] = useState('No export yet.'), [dark, setDark] = useState(false)
  const { setLang } = useT()
  return <main style={{ padding: 20, minHeight: '100vh', boxSizing: 'border-box', font: '14px system-ui',
    background: dark ? '#202020' : '#f8f7f4', color: dark ? '#eee' : '#242424' }}>
    <style>{`.slur-track-export { --bg: ${dark ? '#202020' : '#f8f7f4'}; --text: ${dark ? '#eee' : '#242424'}; }`}</style>
    <h1>Slur Chat · track export test</h1>
    <p>Native Pro Tools bounce → attachment validation. No messages or uploads.</p>
    <button onClick={() => setLang('ko')}>한국어</button> <button onClick={() => setLang('en')}>English</button>{' '}
    <button onClick={() => setDark(old => !old)}>Theme</button>{' '}
    <button onClick={() => location.assign('/?plugin=1&surface=chat&qa=off')}>Open Slur Chat</button>{' '}
    <ExportTracksButton onCapture={async file => {
      const { bundle } = await prepareRegionTransfer([file])
      setResult(`Verified attachment: ${bundle.tracks.length} tracks, ${bundle.regions.length} audio files.\n`
        + bundle.regions.map(region => `${region.name}: ${region.lengthFrames} frames, start ${region.start?.samples}`).join('\n'))
    }} />
    <pre style={{ whiteSpace: 'pre-wrap' }}>{result}</pre>
  </main>
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Harness /></LanguageProvider>)

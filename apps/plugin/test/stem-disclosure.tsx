// Local-only visual regression fixture; no login, uploads or DAW calls.
import { createRoot } from 'react-dom/client'
import StemGroupDisclosure from '../src/components/collab/StemGroupDisclosure'
import { AudioAttachment, ImportAllWord } from '../src/components/collab/ChatView'
import { useAudioDownloads } from '../src/lib/audioDownloads'
import '../src/pages/collab.css'
import '../src/pages/studio.css'

const callbacks = new Map<string, Set<(event: unknown) => void>>()
window.__JUCE__ = {
  initialisationData: { __juce__functions: ['writeAudioFile', 'writeAudioFiles'], __juce__platform: ['mac'] },
  backend: {
    addEventListener(event, callback) { if (!callbacks.has(event)) callbacks.set(event, new Set()); callbacks.get(event)!.add(callback) },
    removeEventListener(event, callback) { callbacks.get(event)?.delete(callback) },
    emitEvent(event, data) {
      if (event !== '__juce__invoke') return
      const request = data as { resultId: number }
      queueMicrotask(() => callbacks.get('__juce__complete')?.forEach(fn => fn({ promiseId: request.resultId, result: 'armed' })))
    },
  },
}
const fixtureTracks = Array.from({ length: 7 }, (_, index) => {
  const wav = new Uint8Array(60), view = new DataView(wav.buffer)
  const tag = (offset: number, text: string) => [...text].forEach((char, i) => { wav[offset + i] = char.charCodeAt(0) })
  tag(0, 'RIFF'); view.setUint32(4, 52, true); tag(8, 'WAVE'); tag(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true)
  view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, 16, true)
  return { url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })), name: `Cache test ${index + 1}.wav` }
})

function DownloadsFixture() {
  const downloads = useAudioDownloads()
  return <section><h2>Shared download state</h2>
    <p>Ready: {fixtureTracks.filter(track => downloads.peek(track.url)).length}/7</p>
    <ImportAllWord tracks={fixtureTracks} groupKey="fixture-all" />
    {fixtureTracks.map(track => <AudioAttachment key={track.url} {...track} />)}
  </section>
}

function Fixture() {
  return <main style={{ fontFamily: 'Arial, sans-serif', maxWidth: 650, padding: 24 }}>
    <h1>Stem disclosure QA</h1>
    {[{ name: 'SUNBURN', count: 7 }, { name: undefined, count: 1 },
      { name: '아주 긴 프로젝트 이름 — Long project name that should stay inside the compact panel', count: 7 }].map((group, i) =>
      <section key={i} style={{ width: i === 2 ? 300 : '100%', marginBottom: 20 }}>
        <StemGroupDisclosure projectName={group.name} trackCount={group.count}
          actions={<ImportAllWord tracks={fixtureTracks.slice(0, group.count)} groupKey={`fixture-group-${i}`} />}>
          {Array.from({ length: group.count }, (_, n) => <div className="wd-plate-sec" key={n} style={{ padding: 12 }}>Track {n + 1}.wav</div>)}
        </StemGroupDisclosure>
      </section>)}
    <DownloadsFixture />
  </main>
}
const root = createRoot(document.getElementById('root')!)
root.render(<Fixture />)
if (import.meta.hot) import.meta.hot.dispose(() => {
  root.unmount()
  for (const track of fixtureTracks) URL.revokeObjectURL(track.url)
  callbacks.clear()
})

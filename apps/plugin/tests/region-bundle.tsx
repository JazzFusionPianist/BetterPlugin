import { createRoot } from 'react-dom/client'
import { useState, useEffect } from 'react'
import RegionBundleAttachment from '../src/components/collab/RegionBundleAttachment'
import { LanguageProvider, useT } from '../src/i18n/LanguageContext'
import { prepareRegionBundle, uploadRegionBundle } from '../src/lib/regionBundle'
import { prepareRegionTransfer } from '../src/lib/regionBundleIO'
import { buildZip } from '../src/lib/zipStore'
import CaptureRegionsButton from '../src/components/collab/CaptureRegionsButton'
import { callJuceNative } from '../src/lib/juceBridge'
import { prepareSharedRegions, rememberRegionEvidence } from '../src/lib/regionSharing'
import { audioDownloadCache } from '../src/lib/audioDownloadCache'
import { useLogicDropCapture } from '../src/lib/logicDropCapture'

const bytes = new Uint8Array(44 + 4800 * 2)
const header = new DataView(bytes.buffer)
const text = (offset: number, value: string) => [...value].forEach((v, i) => header.setUint8(offset + i, v.charCodeAt(0)))
text(0, 'RIFF'); header.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true)
header.setUint32(24, 48000, true); header.setUint32(28, 96000, true)
header.setUint16(32, 2, true); header.setUint16(34, 16, true); text(36, 'data'); header.setUint32(40, bytes.length - 44, true)
const file = new File([bytes], 'Vocal_take_with_a_very_long_name_1234567890.wav', { type: 'audio/wav' })
const originalFetch = window.fetch.bind(window)
const uploaded = new Map<string, File>()
const mockUpload = async (audio: File) => {
  const url = `https://bundle-test.invalid/${crypto.randomUUID()}`
  uploaded.set(url, audio)
  await audioDownloadCache.get(url, async () => {
    const data = new Uint8Array(await audio.arrayBuffer())
    let binary = ''
    for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000))
    return { base64: btoa(binary), bytes: data.length }
  })
  return { url, name: audio.name }
}
window.fetch = async (input, init) => String(input).startsWith('https://bundle-test.invalid/')
  ? uploaded.has(String(input)) ? new Response(uploaded.get(String(input))!) : new Response(null, { status: 404 })
  : originalFetch(input, init)
const prepared = await prepareRegionBundle([file, file], async () => ({ frames: 4800, sampleRate: 48000, channels: 1 }))
const unknown = await uploadRegionBundle(prepared, mockUpload)
const known = structuredClone(unknown)
known[0].regionBundle!.source = { daw: 'Pro Tools', projectId: 'fixture', captureId: 'fixture' }
known[0].regionBundle!.tracks = [{ id: 'voice', name: 'Voice', order: 0, channels: 1 }]
known[0].regionBundle!.regions.forEach((r, i) => { r.trackId = 'voice'; r.start = { samples: i * 9600, sampleRate: 48000 } })
const audioUrl = URL.createObjectURL(file)
// Isolated native protocol double; never calls a DAW or sends network uploads.
if (new URLSearchParams(location.search).has('native')) {
  // Synthetic fixtures do not use production attachment authorization or URLs.
  const bundle = known[0].regionBundle!
  const archive = buildZip([
    { name: 'orb-regions.json', data: new TextEncoder().encode(JSON.stringify({ ...bundle,
      assetPaths: { [bundle.assets[0].id]: 'audio/fixture.wav' },
    })) },
    { name: 'audio/fixture.wav', data: bytes },
  ])
  const data = await new Promise<string>(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(archive)
  })
  const handlers = new Map<number, (data: unknown) => void>()
  let nextSubscription = 0
  window.__JUCE__ = {
    initialisationData: { __juce__functions: ['regionBundleTransfer', 'regionTransferHost'], __juce__platform: ['test'] },
    backend: {
      addEventListener: (event, handler) => {
        const id = nextSubscription++
        handlers.set(id, handler)
        return [event, id]
      },
      removeEventListener: ([, id]) => { handlers.delete(id) },
      emitEvent: (_, event) => {
        const request = event as { name: string; params: string[]; resultId: number }
        if (request.name === 'regionTransferHost') {
          const host = new URLSearchParams(location.search).get('host') === 'logic' ? 'Logic Pro' : 'Pro Tools'
          queueMicrotask(() => handlers.forEach(handler => handler({ promiseId: request.resultId, result: host })))
          return
        }
        const result = request.params[0] === 'inspectLogic' ? { ok: true, snapshot: {
          version: 1, projectId: 'file:///private/test.logicx/', tracks: [
            { AXDescription: 'Track 6 "Guitar"', regions: [{ AXDescription: file.name, AXSelected: true,
              AXHelp: 'Region starts at 2 bars 11 ticks  and ends at 2 bars 3 divisions 171 ticks , Audio region.' }] },
          ],
        } } : ['capture', 'captureLogic'].includes(request.params[0]) ? { ok: true, data }
          : request.params[0] === 'import' ? { ok: true, status: 'complete' }
          : request.params[0] === 'exportLogic' ? { ok: true, status: 'saved' }
          : ['prepareLogic', 'armLogic', 'dropLogic'].includes(request.params[0])
            ? { ok: false, error: 'Dialog-driven Logic restoration is disabled.' }
          : { ok: true, sessionId: 'fixture' }
        queueMicrotask(() => handlers.forEach(handler => handler({ promiseId: request.resultId, result: JSON.stringify(result) })))
      },
    },
  }
}
function Harness() {
  const captureLogicDrop = useLogicDropCapture()
  const [dark, setDark] = useState(false)
  const [roundTrip, setRoundTrip] = useState<typeof known | null>(null)
  const [failure, setFailure] = useState('')
  const [diagnostic, setDiagnostic] = useState('')
  const [dropped, setDropped] = useState<string[]>([])
  const [metadata, setMetadata] = useState('')
  useEffect(() => {
    let generation = 0
    let count = 1
    let pending: { file: File; seq: number }[] = []
    const start = (event: Event) => {
      generation++
      count = (event as CustomEvent<{ count: number }>).detail.count
      pending = []; setDropped([]); setMetadata(''); setRoundTrip(null); setFailure('')
    }
    const report = (event: Event) => setDiagnostic((event as CustomEvent<string>).detail)
    const drop = (event: Event) => {
      const { name, data, seq, region } = (event as CustomEvent<{name:string;data:string;seq:number;region?:unknown}>).detail
      setDropped(current => [...current, `${seq}: ${name} (${atob(data).length} bytes)`])
      try {
        const file = new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], name)
        pending.push({ file: region ? rememberRegionEvidence(file, region) : file, seq })
        if (pending.length !== count) return
        const files = pending.sort((a, b) => a.seq - b.seq).map(item => item.file)
        const current = generation
        void prepareSharedRegions(files).then(async prepared => {
          const entries = await uploadRegionBundle(prepared, mockUpload)
          if (current !== generation) return
          setRoundTrip(entries)
          setMetadata(JSON.stringify({ source: prepared.bundle.source, tracks: prepared.bundle.tracks,
            regions: prepared.bundle.regions }, null, 2))
        }).catch(error => { if (current === generation) setFailure(String(error)) })
      } catch (error) { setFailure(String(error)) }
    }
    const rejected = () => { generation++; pending = []; setFailure('Native drop failed. No files sent.') }
    window.addEventListener('__juceDropGroupStart', start)
    window.addEventListener('__juceFileDropRejected', rejected)
    window.addEventListener('__juceRegionDropError', rejected)
    window.addEventListener('__orbDropDiagnostic', report)
    window.addEventListener('__juceFileDrop', drop)
    return () => {
      generation++
      window.removeEventListener('__juceDropGroupStart', start)
      window.removeEventListener('__juceFileDropRejected', rejected)
      window.removeEventListener('__juceRegionDropError', rejected)
      window.removeEventListener('__orbDropDiagnostic', report)
      window.removeEventListener('__juceFileDrop', drop)
    }
  }, [])
  const { setLang } = useT()
  return <main style={{ padding: 16, minHeight: '100vh', boxSizing: 'border-box', font: '14px Arial',
    background: dark ? '#202020' : '#faf9f6', color: dark ? '#eee' : '#222' }}>
    <button onClick={() => setDark(v => !v)}>Theme</button>
    <button onClick={() => setLang('ko')}>Korean</button>
    <button onClick={() => setLang('en')}>English</button>
    <button onClick={() => void callJuceNative('setPluginSize', [420, 600])}>Small</button>
    <button onClick={() => location.assign('/?plugin=1&surface=chat')}>Return to app</button>
    <p>Local fixture: no chat messages or uploads.</p>
    <button onClick={async () => {
      setFailure(''); setRoundTrip(null)
      try {
        window.dispatchEvent(new CustomEvent('__juceLogicRegionEnter', { detail: { captureId: 'logic-1' } }))
        const files = await captureLogicDrop([file], 'logic-1')
        const prepared = await prepareSharedRegions(files)
        setMetadata(JSON.stringify(prepared.bundle, null, 2))
        setRoundTrip(await uploadRegionBundle(prepared, mockUpload))
      } catch (error) { setFailure(String(error)) }
    }}>Test musical drop</button>
    {diagnostic && <p>{diagnostic}</p>}
    {dropped.map((message, index) => <p key={index}>{message}</p>)}
    <CaptureRegionsButton onCapture={async captured => {
      setFailure('')
      setRoundTrip(await uploadRegionBundle(await prepareRegionTransfer([captured]), mockUpload))
    }} onError={setFailure} />
    <label>Reattach region bundle <input type="file" accept=".orb-regions.zip" onChange={async e => {
      const files = Array.from(e.target.files ?? [])
      setFailure(''); setRoundTrip(null)
      try {
        const transfer = await prepareRegionTransfer(files)
        setRoundTrip(await uploadRegionBundle(transfer, mockUpload))
      } catch (error) { setFailure(String(error)) }
    }} /></label>
    {failure && <p role="alert">{failure}</p>}
    {roundTrip && <RegionBundleAttachment value={roundTrip} />}
    {metadata && <details><summary>Actual drop metadata</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{metadata}</pre></details>}
    <div style={{ maxWidth: 600, margin: '16px auto', display: 'grid', gap: 16 }}>
      <RegionBundleAttachment value={unknown} renderAudio={() => <audio aria-label="Region preview" style={{ width: '100%' }} controls src={audioUrl} />} />
      <RegionBundleAttachment value={known} />
      <RegionBundleAttachment value={[{ regionBundle: { version: 99 } }]} />
    </div>
  </main>
}
const root = createRoot(document.getElementById('root')!)
root.render(<LanguageProvider><Harness /></LanguageProvider>)
import.meta.hot?.dispose(() => {
  root.unmount()
  URL.revokeObjectURL(audioUrl)
  window.fetch = originalFetch
  if (new URLSearchParams(location.search).has('native')) delete window.__JUCE__
})

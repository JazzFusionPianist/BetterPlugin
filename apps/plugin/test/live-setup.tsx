// Local-only visual fixture for the live room's setup form. No login, no
// rows, no capture: the Supabase client is a trap that records any touch
// (window.__supabaseTouched), going live throws, and nothing submits.
//   ?frame=studio   rail + main pane, as StudioShell lays them out (default)
//   ?frame=pane     the studio's live pane alone, filling the window
//   ?frame=classic  the 300×500 plug-in shell (CollabPage)
//   ?friends=N      friends offered by the invite checklist (default 12)
import { createRoot } from 'react-dom/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import '../src/index.css'
// The app's whole module graph, so every stylesheet lands in the app's order.
import '../src/App'
import LivePane from '../src/components/studio/LivePane'
import LivePanel from '../src/components/collab/LivePanel'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import type { Profile } from '../src/types/collab'
import type { VideoSource } from '../src/types/live'

const params = new URLSearchParams(window.location.search)
const frame = params.get('frame') ?? 'studio'

const touched: string[] = []
Object.assign(window, { __supabaseTouched: touched })
const supabase = new Proxy({}, {
  get(_target, prop) { touched.push(String(prop)); throw new Error(`fixture: Supabase touched (${String(prop)})`) },
}) as unknown as SupabaseClient
const refuse = async (): Promise<never> => { throw new Error('fixture: going live is disabled') }

const NAMES = ['jun', 'mina', 'a friend whose display name runs much longer than the column it sits in', '서연',
  'Theo Park', 'ari', 'Noor', 'kenji', 'Lena Vogel', 'sam', 'Ifeoma', 'rio']
const COLORS = ['#3FB872', '#E07A5F', '#6C8EBF', '#C9A227', '#9B6BB3', '#D6402E']
const profile = (id: string, name: string, i: number): Profile => ({
  id, display_name: name, avatar_color: COLORS[i % COLORS.length], initials: name.slice(0, 1).toUpperCase(),
  isOnline: true, is_verified: false, is_admin: false,
})
const ME = 'fixture-me'
const friendCount = Number(params.get('friends') ?? 12)
const profiles = [profile(ME, 'you', 0),
  ...Array.from({ length: friendCount }, (_, i) => profile(`fixture-${i}`, NAMES[i] ?? `friend ${i + 1}`, i + 1))]

// The browser's own list (useMediaSource outside the plug-in), for the classic shell.
const SOURCES: VideoSource[] = [
  { kind: 'none', label: 'no video — audio only' },
  { kind: 'daw', label: 'DAW Window' },
  { kind: 'screen', label: 'Entire Screen' },
  { kind: 'camera', deviceId: 'fixture-cam', label: 'Camera 1' },
]
const MICS = [{ deviceId: 'fixture-mic', label: 'Microphone 1' }]

function Studio({ withRail }: { withRail: boolean }) {
  return <div className="wd-stage"><div className="wd">
    {withRail && <div className="wd-rail"><div className="wd-rail-scroll">
      <div className="wd-row"><span className="wd-av tile" /><span className="wd-rname"><b>games</b></span></div>
      <div className="wd-row on"><span className="wd-av tile" /><span className="wd-rname"><b>live</b></span></div>
    </div></div>}
    <div className="wd-main">
      <LivePane supabase={supabase} userId={ME} me={profiles[0]} profiles={profiles} liveSessions={[]} mySession={null}
        startLive={refuse} endLive={refuse} updateLive={refuse} watchRequest={null} onClose={() => {}} />
    </div>
  </div></div>
}

function Classic() {
  return <div className="plugin live-open">
    <div className="top-bar" />
    <div className="content"><div className="view lvview">
      <LivePanel isOpen mySession={null} liveSessions={[]} profiles={profiles} myProfile={profiles[0]}
        sources={SOURCES} microphones={MICS} localStream={null} viewerCount={0} totalViewers={0} peakViewers={0}
        mediaError={null} screenCaptureSupported currentUserId={ME} chatMessages={[]} onSendChat={() => {}}
        onStartLive={() => { throw new Error('fixture: going live is disabled') }} onBanViewer={() => {}}
        onEndLive={() => {}} onReplaceSource={refuse} onWatchLive={() => {}} onClose={() => {}} />
    </div></div>
  </div>
}

const root = createRoot(document.getElementById('root')!)
root.render(<LanguageProvider>{frame === 'classic' ? <Classic /> : <Studio withRail={frame !== 'pane'} />}</LanguageProvider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())

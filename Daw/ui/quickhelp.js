/* ── quick help (his ask, 2026-10-21) ──
   A small ? on the transport panel (and Help > Quick Help). On, whatever the pointer rests on says, in a small card just
   under the pointer, what it is, the key it answers to — the key of the set in use (settings > key commands), so another
   DAW's keys read as they are — and what a press or a pull of it does. On the lanes it says what the tool would do just
   there (the smart tool's zones). Off, nothing is shown. The app remembers which. Read after panel.js and mixpanel.js. */
const QH = { on: (() => { try { return localStorage.getItem('slur.quickhelp') === '1' } catch (e) { return false } })(), el: null, at: '', timer: 0, x: 0, y: 0 }

/* what each thing is: [name, its name in Korean, what it does, in Korean, the key (a menu line, or a key as KEYS names it)] */
const QH_SAY = {
  qhelp: ['quick help', '빠른 도움말', 'on: whatever the pointer rests on says what it is and its key, here', '켜면 포인터가 놓인 곳이 무엇인지, 단축키와 함께 여기에 알려 줍니다', 'Help > Quick Help'],
  play: ['play', '재생', 'plays from the playhead; pressed again, stops', '플레이헤드부터 재생합니다. 다시 누르면 멈춥니다', 'Transport > Play or Stop'],
  stop: ['stop', '정지', 'stops the song', '곡을 멈춥니다', 'Transport > Play or Stop'],
  rec: ['record', '녹음', 'records on the armed tracks from the playhead', '녹음 대기된 트랙에 플레이헤드부터 녹음합니다', 'Transport > Record'],
  tostart: ['to the start', '처음으로', 'takes the playhead to the start of the song', '플레이헤드를 곡의 처음으로 보냅니다', 'Transport > Go to Start'],
  pos: ['where the song is', '곡의 위치', 'bar . beat . division . tick. Press it to type a place to go to', '마디 . 박 . 분할 . 틱. 누르면 갈 곳을 입력합니다', 'Transport > Go to Bar…'],
  smpte: ['time', '시간', 'the time as SMPTE. Press it to type a time to go to; right press: its frame rate and where it begins', 'SMPTE 시간. 누르면 갈 시간을 입력합니다. 오른쪽 클릭: 프레임 레이트와 시작 시간', ''],
  meter: ['measure', '박자', 'the time signature; press it to pick another. The squares show the beat sounding', '박자표. 누르면 다른 박자를 고릅니다. 네모는 지금 울리는 박입니다', ''],
  tempo: ['tempo', '템포', 'beats a minute. Press it to type one', '분당 박 수. 누르면 입력합니다', ''],
  loop: ['cycle', '사이클', 'turns the cycle on or off: the song goes round between its ends', '사이클을 켜고 끕니다. 곡이 양 끝 사이를 돌아갑니다', 'Transport > Cycle'],
  key: ['key', '조', 'the song\'s key. Press it to type one', '곡의 조. 누르면 입력합니다', ''],
  click: ['click', '클릭', 'the metronome, on or off (never printed)', '메트로놈을 켜고 끕니다 (프린트되지 않습니다)', 'Transport > Click'],
  lowlat: ['low latency', '저지연', 'what is heard live skips plug-ins that would make it late', '실시간으로 듣는 소리가 늦어지게 하는 플러그인을 건너뜁니다', ''],
  master: ['the out', '아웃', 'the level of everything to the speakers. Drag up or down', '스피커로 나가는 전체 레벨. 위아래로 끕니다', ''],
  'tp-clip': ['clip light', '클립 표시', 'lights red once the mix has gone over. Press it to let it go', '믹스가 넘친 적이 있으면 빨갛게 켜집니다. 누르면 꺼집니다', ''],
  addtrack: ['new track', '새 트랙', 'makes a new track: sound, notes or a bus', '새 트랙을 만듭니다: 오디오, 노트, 버스', 'Track > New Tracks…'],
  look: ['the chosen track\'s look', '고른 트랙의 모습', 'its colour and outline. Press to change them', '색과 모양. 누르면 바꿉니다', 'Region > Colour and Outline…'],
  toolmenu: ['tool', '도구', 'what a press in the lanes does. Press for the list', '레인에서 누르면 하는 일. 누르면 목록이 열립니다', 'Tools > Tool > Tool Menu'],
  modemenu: ['edit mode', '편집 모드', 'how regions move: smart, grid, slip, shuffle, spot', '리전이 움직이는 방식: smart, grid, slip, shuffle, spot', ''],
  grid: ['grid', '그리드', 'what a move snaps to', '움직일 때 맞춰지는 간격', ''],
  nudge: ['nudge', '넛지', 'how far ⌥← and ⌥→ move what is chosen', '⌥←, ⌥→로 고른 것을 움직이는 거리', ''],
  autokey: ['automation', '오토메이션', 'shows the lines of each track, to draw and move', '트랙마다 라인을 보여 줍니다. 그리고 움직입니다', 'View > Automation'],
  flexkey: ['rubato', '루바토', 'shows where the sound\'s beats are, to move them in time', '소리의 박 위치를 보여 주고 시간을 옮길 수 있게 합니다', 'View > Rubato View'],
  zoomx: ['zoom across', '가로 줌', 'how much of the song the window shows. Drag', '창에 보이는 곡의 길이. 끕니다', 'View > Zoom In'],
  zoomy: ['zoom down', '세로 줌', 'how tall the rows are. Drag', '줄의 높이. 끕니다', 'View > Taller Rows'],
  sel: ['track', '트랙', 'press: choose it; ⇧ press: to here; ⌘ press: add or take away. Drag up or down to move it; double press to rename', '누르기: 고르기. ⇧ 누르기: 여기까지. ⌘ 누르기: 더하거나 빼기. 위아래로 끌면 옮기고, 두 번 누르면 이름을 바꿉니다', 'Track > Rename…'],
  arm: ['record enable', '녹음 대기', 'r: this track takes the next recording', 'r: 다음 녹음을 이 트랙이 받습니다', 'Track > Record Enable'],
  mon: ['hear the input', '입력 듣기', 'i: what comes in is heard through the track', 'i: 들어오는 소리를 트랙을 거쳐 듣습니다', 'Track > Hear the Input'],
  mute: ['mute', '뮤트', 'm: silent. Drag across rows to set them all the same', 'm: 소리를 끕니다. 여러 줄을 끌면 모두 같게 됩니다', 'Track > Mute'],
  solo: ['solo', '솔로', 's: only the soloed tracks are heard. Drag across rows to set them all the same', 's: 솔로한 트랙만 들립니다. 여러 줄을 끌면 모두 같게 됩니다', 'Track > Solo'],
  vol: ['level', '레벨', 'drag to set; ⇧ drag: finely; double press: 0 dB', '끌어서 맞춥니다. ⇧ 끌기: 미세하게. 두 번 누르기: 0 dB', ''],
  volnum: ['level', '레벨', 'double press to type it; ⌥ press: 0 dB', '두 번 누르면 입력합니다. ⌥ 누르기: 0 dB', ''],
  rowh: ['row height', '줄 높이', 'drag to make this row taller or shorter (every chosen row with it)', '끌어서 이 줄을 높이거나 낮춥니다 (고른 줄 모두)', 'View > Taller Rows'],
  fold: ['stack', '스택', 'opens or folds the tracks in it', '안의 트랙을 펼치거나 접습니다', ''],
  inst: ['instrument', '악기', 'opens the instrument\'s window, or the list to pick one', '악기 창을 열거나, 고를 목록을 엽니다', ''],
  cycle: ['cycle area', '사이클 구간', 'drag along it to set where the cycle goes round; drag its ends to move them', '끌어서 사이클 구간을 정합니다. 양 끝을 끌면 옮겨집니다', 'Transport > Cycle Area > Set to Selection'],
  seek: ['bars', '마디', 'press or drag to move the playhead', '누르거나 끌어서 플레이헤드를 옮깁니다', ''],
  playhead: ['playhead', '플레이헤드', 'drag it along the song', '곡을 따라 끕니다', 'View > Show the Playhead'],
  scene: ['marker', '마커', 'press: go to it; drag: move it; double press: rename', '누르기: 그곳으로. 끌기: 옮기기. 두 번 누르기: 이름 바꾸기', 'Markers > Add Marker Here'],
  plugs: ['add a plug-in', '플러그인 넣기', 'opens the list of prints and plug-ins', '프린트와 플러그인 목록을 엽니다', 'View > Patch'],
  print: ['print', '프린트', 'drag up or down for how much', '위아래로 끌어 양을 정합니다', ''],
  sheet: ['keys', '키', 'every key of the room, on one sheet', '방의 모든 키를 한 장에 보여 줍니다', 'Help > Key Commands'],
  mvol: ['fader', '페이더', 'drag up or down; ⇧ drag: finely; double press: 0 dB', '위아래로 끕니다. ⇧ 끌기: 미세하게. 두 번 누르기: 0 dB', ''],
  mmaster: ['the out\'s fader', '아웃 페이더', 'the level to the speakers. Drag up or down', '스피커로 가는 레벨. 위아래로 끕니다', ''],
  mpan: ['pan', '팬', 'drag right or up for the right; double press: the middle', '오른쪽이나 위로 끌면 오른쪽. 두 번 누르기: 가운데', ''],
  msend: ['send', '센드', 'drag across for how much goes to the bus; ⇧ drag: finely', '좌우로 끌어 버스로 보낼 양을 정합니다. ⇧ 끌기: 미세하게', ''],
  'mp-send': ['send', '센드', 'turn it for how much goes to its bus', '돌려서 버스로 보낼 양을 정합니다', ''],
  msendadd: ['new send', '새 센드', 'sends this track to a bus as well (ten at most)', '이 트랙을 버스로도 보냅니다 (최대 10개)', ''],
  mfx: ['plug-in', '플러그인', 'press: open it; ⌥ drag onto another strip: copy it; right press: more', '누르기: 열기. 다른 스트립으로 ⌥ 끌기: 복사. 오른쪽 클릭: 더 보기', ''],
  mfxadd: ['add a plug-in', '플러그인 넣기', 'opens the list of plug-ins for this track', '이 트랙에 넣을 플러그인 목록을 엽니다', ''],
  msel: ['strip', '스트립', 'press: choose the track; ⇧ press: to here; ⌘ press: add or take away', '누르기: 트랙 고르기. ⇧ 누르기: 여기까지. ⌘ 누르기: 더하거나 빼기', ''],
  mout: ['output', '출력', 'where the track goes: the stereo out or a bus', '트랙이 가는 곳: 스테레오 아웃이나 버스', ''],
  'm-patch': ['patch', '패치', 'opens the track\'s patch below', '아래에 트랙의 패치를 엽니다', 'View > Patch'],
  audiokey: ['audio device', '오디오 장치', 'the device, its rate and buffer', '장치, 레이트, 버퍼', 'Slur Studio > Settings > Audio'],
  'tab-patch': ['patch', '패치', 'the chosen track\'s patch: prints and plug-ins', '고른 트랙의 패치: 프린트와 플러그인', 'View > Patch'],
  'tab-mixer': ['mixer', '믹서', 'every track\'s strip', '모든 트랙의 스트립', 'View > Mixer'],
  'tab-notes': ['notes', '노트', 'the notes of the chosen region', '고른 리전의 노트', 'View > Notes'],
  'tab-rubato': ['rubato', '루바토', 'the rubato panel', '루바토 패널', 'View > Rubato Panel'],
  pgrip: ['panel height', '패널 높이', 'drag up or down', '위아래로 끕니다', ''],
  /* the lanes: what a press would do just there */
  'lanes:range': ['pick a stretch', '구간 고르기', 'drag to choose a stretch of time across the tracks', '끌어서 트랙들에 걸친 시간 구간을 고릅니다', ''],
  'lanes:grab': ['move the region', '리전 옮기기', 'drag it; ⌥ drag: a copy; ⇧ drag to another track: it keeps its place in time', '끌어서 옮깁니다. ⌥ 끌기: 복사. 다른 트랙으로 ⇧ 끌기: 시간 위치를 그대로', 'Region > Nudge > Later'],
  'lanes:tl': ['trim the start', '시작 다듬기', 'drag the region\'s start', '리전의 시작을 끕니다', 'Region > Trim Start to Playhead'],
  'lanes:tr': ['trim the end', '끝 다듬기', 'drag the region\'s end', '리전의 끝을 끕니다', 'Region > Trim End to Playhead'],
  'lanes:fi': ['fade in', '페이드 인', 'drag to make the fade in longer or shorter', '끌어서 페이드 인 길이를 정합니다', 'Region > Fades > Fade In up to the Playhead'],
  'lanes:fo': ['fade out', '페이드 아웃', 'drag to make the fade out longer or shorter', '끌어서 페이드 아웃 길이를 정합니다', 'Region > Fades > Fade Out from the Playhead'],
  'lanes:x': ['crossfade', '크로스페이드', 'where two regions meet: drag for a crossfade', '두 리전이 만나는 곳: 끌어서 크로스페이드를 만듭니다', 'Region > Fades > Fades for Selection'],
  'lanes:auto': ['automation', '오토메이션', 'press on a line: a point; drag a point to move it; ⌫ takes the chosen ones away', '라인을 누르면 점이 생기고, 점을 끌면 옮겨집니다. ⌫로 고른 점을 지웁니다', 'View > Automation'],
  'lanes:empty': ['lanes', '레인', 'press to put the playhead here; drag to pick regions', '누르면 플레이헤드가 여기로 옵니다. 끌면 리전을 고릅니다', ''],
  'tool:pencil': ['pencil', '연필', 'draws a region, or notes', '리전이나 노트를 그립니다', 'Tools > Tool > Pencil'],
  'tool:eraser': ['eraser', '지우개', 'takes away what it is pressed on', '누른 것을 지웁니다', 'Tools > Tool > Eraser'],
  'tool:scissors': ['scissors', '가위', 'cuts a region where it is pressed', '누른 곳에서 리전을 자릅니다', 'Edit > Split at Playhead'],
  'tool:join': ['join', '붙이기', 'joins the chosen regions into one', '고른 리전을 하나로 붙입니다', 'Edit > Join'],
  'tool:mute': ['mute tool', '뮤트 도구', 'mutes or unmutes the region pressed', '누른 리전을 뮤트하거나 풉니다', 'Region > Mute'],
  'tool:gain': ['gain', '게인', 'drag a region up or down for its level', '리전을 위아래로 끌어 레벨을 정합니다', 'Region > Gain > Up 1 dB'],
  'tool:fade': ['fade', '페이드', 'drag at a region\'s ends for fades', '리전 끝에서 끌어 페이드를 만듭니다', 'Region > Fades > Fades for Selection'],
  'tool:marquee': ['marquee', '마키', 'picks a stretch of time to cut, copy or play', '자르거나 복사하거나 재생할 시간 구간을 고릅니다', ''],
  'tool:zoom': ['zoom', '줌', 'drag around what to see close; press again to go back', '가까이 볼 곳을 끌어 감쌉니다. 다시 누르면 돌아옵니다', 'View > Zoom to Fit or Selection'],
  'tool:flex': ['rubato tool', '루바토 도구', 'pulls a beat of the sound to another time', '소리의 박을 다른 시간으로 당깁니다', 'View > Rubato View'],
  'tool:velocity': ['velocity', '벨로시티', 'drag a note up or down for how hard it is played', '노트를 위아래로 끌어 세기를 정합니다', ''],
}

/* the key a menu line answers to, in the set in use, as it is written (⌘B) */
let QH_MENU = null
function qhKey (cmd) {
  if (!cmd) return ''
  if (!QH_MENU) {
    QH_MENU = new Map()
    const walk = (lines, path) => { for (const l of lines) { if (l === '-') continue; const [t, k, o = {}] = l; if (o.sub) walk(o.sub, `${path} > ${t}`); else QH_MENU.set(`${path} > ${t}`, [k, o]) } }
    try { for (const [m, lines] of MENU_BAR()) walk(lines, m) } catch (e) {}
  }
  const line = QH_MENU.get(cmd)
  if (!line) return ''
  const k = typeof kcShown === 'function' ? kcShown(cmd, line[0], line[1].k) : line[0] || line[1].k
  return k && typeof keySaid === 'function' ? keySaid(k) : ''
}
/* what the pointer is on: a key into QH_SAY */
function qhWhat (e) {
  const el = e.target && e.target.closest ? e.target.closest('[data-a]') : null
  if (!el) return ''
  const a = el.dataset.a
  if (a !== 'lanes') return a
  const p = pt(e)
  if (S.auto) return 'lanes:auto'
  const ti = laneAt(p.y)
  if (ti == null || !S.tracks[ti]) return 'lanes:empty'
  if (S.tool === 'smart') { const z = smartZone(ti, p).z; return 'lanes:' + z }
  if (S.tool === 'pointer') { const r = hitRegion(ti, barAt(p.x)); if (!r) return 'lanes:empty'; const end = endAt(ti, p); return end ? (end[1] === 'l' ? 'lanes:tl' : 'lanes:tr') : 'lanes:grab' }
  return 'tool:' + S.tool
}
/* the card: its name and key on one line, what it does under it */
function qhCard () {
  if (QH.el) return QH.el
  const st = document.createElement('style')
  st.textContent = `.qh{position:fixed;z-index:60;pointer-events:none;max-width:236px;padding:6px 8px 7px;border-radius:2px;font:400 10px/1.38 'Instrument Sans',sans-serif;letter-spacing:.01em;display:none}
.qh b{font-weight:500;font-size:10.5px}.qh .d{margin-top:2px;opacity:.7}.qh .c{margin-top:5px;opacity:.85}.qh .k{display:inline-block;margin-right:6px;padding:0 4px;border-radius:2px;font-size:9.5px;line-height:14px}`
  document.head.appendChild(st)
  QH.el = document.createElement('div'); QH.el.className = 'qh'; document.body.appendChild(QH.el)
  return QH.el
}
function qhShow (what) {
  const say = QH_SAY[what], el = qhCard()
  if (!say) { el.style.display = 'none'; return }
  const ko = typeof LANG === 'object' && LANG.now === 'ko', k = qhKey(say[4]), esc0 = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  /* the key, and the menu line it runs (its own words, below the menu's name: "Nudge > Later") — so a key that does a near
     thing says which */
  const line = k ? say[4].split(' > ').slice(1).map(w => typeof menuWord === 'function' ? menuWord(w) : w).join(' > ') : ''
  el.style.background = K2; el.style.color = INK; el.style.border = `1px solid ${INK}44`
  el.innerHTML = `<b>${esc0(ko ? say[1] : say[0])}</b><div class="d">${esc0(ko ? say[3] : say[2])}</div>${k ? `<div class="c"><span class="k" style="border:1px solid ${INK}66">${esc0(k)}</span>${esc0(line)}</div>` : ''}`
  el.style.display = 'block'
  qhPlace()
}
/* just under the pointer; kept inside the window */
function qhPlace () {
  const el = QH.el
  if (!el || el.style.display === 'none') return
  const w = el.offsetWidth, h = el.offsetHeight
  let x = QH.x - 6, y = QH.y + 22
  if (x + w > innerWidth - 6) x = innerWidth - 6 - w
  if (y + h > innerHeight - 6) y = QH.y - 10 - h
  el.style.left = Math.max(6, x) + 'px'; el.style.top = Math.max(6, y) + 'px'
}
function qhHide () { clearTimeout(QH.timer); QH.at = ''; if (QH.el) QH.el.style.display = 'none' }
function qhMove (e) {
  if (!QH.on) return
  QH.x = e.clientX; QH.y = e.clientY
  if (typeof drag !== 'undefined' && drag) { qhHide(); return }
  const what = qhWhat(e)
  if (what === QH.at) { qhPlace(); return }
  QH.at = what
  clearTimeout(QH.timer)
  if (QH.el) QH.el.style.display = 'none'
  if (what) QH.timer = setTimeout(() => qhShow(what), 160)                             // (a moment's rest first: not a card for everything the pointer crosses)
}
function qhToggle () {
  QH.on = !QH.on
  try { localStorage.setItem('slur.quickhelp', QH.on ? '1' : '0') } catch (e) {}
  if (!QH.on) qhHide()
  if (typeof menusTick === 'function') menusTick()
  uiDirty('top')
}
addEventListener('pointermove', qhMove, { passive: true })
addEventListener('pointerdown', () => qhHide(), true)
addEventListener('blur', () => qhHide())

/* the ? on the transport panel: its top right, beside stop; filled while on */
{
  const left0 = SKINS.left.panel
  SKINS.left.panel = function () {
    const s = left0.apply(this, arguments), x = TPX.CW - 24, y = 24
    const q = (QH.on ? Cc(x, y, 8, { fill: INK }) : Cc(x, y, 7.5, { stroke: INK, sa: .5, sw: 1 })) + T(x, y + 3.5, '?', { size: 10, w: 600, c: QH.on ? K2 : INK, a: QH.on ? 1 : .7, anchor: 'middle' }) + hit(x - 12, y - 12, 24, 24, 'qhelp')
    /* inside the panel's own column (moved left by its width, and hidden with it): before its two groups close */
    return s.endsWith('</g></g>') ? s.slice(0, -8) + q + '</g></g>' : s + G(q, `translate(${TPX.o != null ? TPX.o : -TPX.CW} 0)`)
  }
  const down0 = onDown
  onDown = function (e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-a="qhelp"]') : null
    if (el) { e.preventDefault(); qhToggle(); return }
    return down0(e)
  }
}

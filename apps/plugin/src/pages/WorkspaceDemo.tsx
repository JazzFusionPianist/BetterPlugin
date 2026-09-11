// TEMP mockup — Orb Studio workspace concept (option B). DELETE before commit.
// ?workdemo — 800×550 wide layout: project-first rail, tabs, chat pane.

const S = `
.wd { width: 820px; height: 560px; display: flex; background: #FBFAF7; color: #1A1917;
  font-family: 'Instrument Sans', 'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif;
  font-size: 13px; border: 1px solid rgba(26,25,23,.5); overflow: hidden; }
.wd * { box-sizing: border-box; margin: 0; }
.wd-serif { font-family: 'Instrument Serif', 'Pretendard Variable', serif; font-weight: 400; }
.wd-rail { width: 232px; border-right: 1px solid rgba(26,25,23,.16); display: flex; flex-direction: column; padding: 14px 0 10px; }
.wd-brand { font-family: 'Instrument Serif', serif; font-size: 17px; padding: 0 16px 12px; display: flex; align-items: center; gap: 7px; }
.wd-brand i { width: 8px; height: 8px; border-radius: 50%; background: #2440FF; }
.wd-sec { font-size: 10px; letter-spacing: .12em; color: #A5A199; text-transform: lowercase; padding: 12px 16px 5px; }
.wd-row { display: flex; align-items: center; gap: 9px; padding: 7px 16px; cursor: pointer; }
.wd-row.on { background: rgba(36,64,255,.06); box-shadow: inset 2px 0 0 #2440FF; }
.wd-av { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 11px; position: relative; }
.wd-av.grp { border-radius: 8px; }
.wd-dot { position: absolute; right: -1px; bottom: -1px; width: 8px; height: 8px; border-radius: 50%;
  background: #1E9E63; border: 2px solid #FBFAF7; }
.wd-dot.studio { background: #2440FF; animation: wdbreathe 2.4s ease-in-out infinite; }
@keyframes wdbreathe { 0%,100% { box-shadow: 0 0 0 0 rgba(36,64,255,.35);} 50% { box-shadow: 0 0 0 4px rgba(36,64,255,0);} }
.wd-rname { flex: 1; min-width: 0; }
.wd-rname b { display: block; font-weight: 500; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wd-rname span { display: block; font-size: 10.5px; color: #A5A199; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wd-rname span.studio { color: #2440FF; font-style: italic; font-family: 'Instrument Serif', serif; }
.wd-badge { background: #2440FF; color: #fff; font-size: 9.5px; min-width: 16px; height: 16px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; padding: 0 5px; }
.wd-rail-foot { margin-top: auto; padding: 10px 16px 0; border-top: 1px solid rgba(26,25,23,.16);
  display: flex; align-items: center; gap: 8px; font-size: 11px; color: #6E6B63; }
.wd-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.wd-head { padding: 14px 22px 0; border-bottom: 1px solid rgba(26,25,23,.16); }
.wd-title { font-family: 'Instrument Serif', serif; font-size: 21px; }
.wd-sub { font-size: 11px; color: #A5A199; margin-top: 1px; }
.wd-tabs { display: flex; gap: 18px; margin-top: 10px; }
.wd-tab { font-size: 12.5px; color: #6E6B63; padding-bottom: 8px; cursor: pointer; }
.wd-tab.on { color: #1A1917; box-shadow: inset 0 -1px 0 #1A1917; }
.wd-tab i { font-style: normal; color: #2440FF; margin-left: 4px; font-size: 10px; }
.wd-chat { flex: 1; padding: 16px 22px; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.wd-day { text-align: center; font-size: 10px; color: #A5A199; margin: 4px 0 8px; }
.wd-meta { display: flex; align-items: baseline; gap: 7px; margin-top: 9px; }
.wd-meta b { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 13.5px; }
.wd-meta span { font-size: 9.5px; color: #A5A199; }
.wd-msg { font-size: 13px; line-height: 1.5; max-width: 480px; }
.wd-file { display: flex; align-items: center; gap: 10px; border: 1px solid rgba(26,25,23,.16); background: #fff;
  padding: 8px 12px; margin-top: 5px; max-width: 320px; border-radius: 4px; }
.wd-file i { font-style: normal; color: #2440FF; }
.wd-file small { color: #A5A199; }
.wd-input { margin: 0 22px 16px; display: flex; gap: 8px; align-items: center;
  border: 1px solid rgba(26,25,23,.5); background: #fff; border-radius: 6px; padding: 9px 12px; }
.wd-input span { color: #A5A199; flex: 1; }
.wd-input .wd-send { flex: 0 0 26px; width: 26px; height: 26px; border-radius: 4px; background: #2440FF; display: flex; align-items: center;
  justify-content: center; color: #fff; font-size: 12px; }
`

const av = (bg: string, ch: string, cls = '', dot?: 'on' | 'studio') => (
  <span className={`wd-av ${cls}`} style={{ background: bg }}>{ch}
    {dot && <span className={`wd-dot${dot === 'studio' ? ' studio' : ''}`} />}
  </span>
)

export default function WorkspaceDemo() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', background: '#191817' }}>
      <style>{S}</style>
      <div className="wd">
        <div className="wd-rail">
          <div className="wd-brand"><i />orb studio</div>
          <div className="wd-sec">projects</div>
          <div className="wd-row on">{av('#2440FF', '여', 'grp')}<span className="wd-rname"><b>여름 앨범</b><span>mina: 훅 멜로디 하나 뽑았어</span></span><span className="wd-badge">3</span></div>
          <div className="wd-row">{av('#4C5B3F', '두', 'grp')}<span className="wd-rname"><b>두식이에게</b><span>jayden: 스템 올렸어</span></span></div>
          <div className="wd-row">{av('#8B7355', 'F', 'grp')}<span className="wd-rname"><b>FLY (remix)</b><span>demo_v3.wav</span></span></div>
          <div className="wd-sec">people</div>
          <div className="wd-row">{av('#E2725B', 'M', '', 'studio')}<span className="wd-rname"><b>mina</b><span className="studio">in the studio · 2h</span></span></div>
          <div className="wd-row">{av('#4A8FE7', 'J', '', 'on')}<span className="wd-rname"><b>jayden</b><span>online</span></span><span className="wd-badge">1</span></div>
          <div className="wd-row">{av('#A5A199', 'S')}<span className="wd-rname"><b>sol</b><span>offline</span></span></div>
          <div className="wd-rail-foot">{av('#1A1917', 'S', '', 'studio')}<span>steven · in the studio</span></div>
        </div>
        <div className="wd-main">
          <div className="wd-head">
            <div className="wd-title">여름 앨범</div>
            <div className="wd-sub">3 members · 2 in the studio now</div>
            <div className="wd-tabs">
              <span className="wd-tab on">chat</span>
              <span className="wd-tab">stems<i>4</i></span>
              <span className="wd-tab">calendar<i>2</i></span>
              <span className="wd-tab">notes</span>
            </div>
          </div>
          <div className="wd-chat">
            <div className="wd-day">today</div>
            <div className="wd-meta"><b>mina</b><span>10:12</span></div>
            <div className="wd-msg">훅 멜로디 하나 뽑았어 — 벌스 코드 위에 얹어봤는데 들어봐줘</div>
            <div className="wd-file"><i>♪</i><span>hook_idea_v2.wav</span><small>0:34</small></div>
            <div className="wd-meta"><b>jayden</b><span>10:19</span></div>
            <div className="wd-msg">오 이거다. 브릿지에서 반키 올리면 어때?</div>
            <div className="wd-meta"><b>steven</b><span>10:21</span></div>
            <div className="wd-msg">금요일 8시 합주 때 맞춰보자 → 캘린더에 넣어둠</div>
          </div>
          <div className="wd-input"><span>message 여름 앨범…</span><span className="wd-send">→</span></div>
        </div>
      </div>
    </div>
  )
}

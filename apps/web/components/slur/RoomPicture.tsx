import { C } from './marks'

/* A drawn picture of the room you land in after logging in — not a
   screenshot: every size is in em so it scales as one picture. */

const WAVE = (() => {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 100 }, (_, i) => {
    const env = Math.sin(Math.PI * i / 100) * .7 + .3
    return Math.max(1.4, (rnd() * .8 + .2) * 18 * env)
  })
})()

const Av = ({ color, round, live }: { color: string; round?: boolean; live?: boolean }) => (
  <div className={`sl-av${round ? ' p' : ''}`} style={{ background: color }}>{live && <span className="sl-dot" />}</div>
)

export default function RoomPicture () {
  return (
    <div className="sl-win" aria-hidden="true">
      <div className="sl-rail">
        <h6>projects</h6>
        <div className="sl-row on"><Av color={C.blue} /><div className="t"><b>hanroro ep</b><small>jun: bridge take 3 is up</small></div><span className="sl-badge">2</span></div>
        <div className="sl-row"><Av color={C.orange} /><div className="t"><b>friday set</b><small>soundcheck 5pm</small></div></div>
        <div className="sl-row"><Av color={C.lilac} /><div className="t"><b>demos</b><small>voice memo 0:42</small></div></div>
        <h6>people</h6>
        <div className="sl-row"><Av color={C.rose} round live /><div className="t"><b>jun</b><small className="live">in the studio 2h</small></div></div>
        <div className="sl-row"><Av color={C.yellow} round /><div className="t"><b>minseo</b><small>ok see you then</small></div></div>
        <div className="sl-row me"><Av color={C.ink} round live /><div className="t"><b>you</b><small className="live">in the studio</small></div></div>
      </div>
      <div className="sl-pane">
        <div className="sl-pane-h">
          <b>hanroro ep</b>
          <small>4 members <em>2 in the studio now</em></small>
          <div className="sl-tabs"><span className="on">chat</span><span>stems<sup>6</sup></span><span>calendar<sup>2</sup></span><span>notes</span></div>
        </div>
        <div className="sl-msgs">
          <span className="sl-day">today</span>
          <div className="sl-m"><Av color={C.rose} round /><div><div className="sl-who">jun</div>
            <div className="sl-stem">
              <div className="l1"><b>bridge take 3</b><i>0:38</i></div>
              <svg viewBox="0 0 200 20" preserveAspectRatio="none">
                {WAVE.map((h, i) => <rect key={i} x={i * 2} y={10 - h / 2} width={1.2} height={h} rx={.6} fill={C.ink} opacity={i * 2 < 62 ? 1 : .28} />)}
                <rect x={62} y={0} width={1.2} height={20} fill={C.green} />
              </svg>
              <div className="l2"><span>bar 17</span><span>48k</span><u>import to daw</u></div>
            </div></div></div>
          <div className="sl-m"><Av color={C.rose} round /><div className="sl-bub">snare&rsquo;s a bit late on the 2nd one</div></div>
          <div className="sl-m mine"><div className="sl-bub">fixing it now, back in 10</div></div>
          <div className="sl-m"><Av color={C.yellow} round /><div className="sl-bub">rehearsal fri 7pm?</div></div>
        </div>
        <div className="sl-inp">message hanroro ep</div>
      </div>
    </div>
  )
}

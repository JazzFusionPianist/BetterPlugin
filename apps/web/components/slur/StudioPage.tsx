'use client'

import { useEffect, useRef } from 'react'
import SlurMark from './SlurMark'
import PictoNav from './PictoNav'
import { C } from './marks'
import { mountStudio } from './studioScenes'
import '@/app/slur.css'
import '@/app/slur-studio.css'

/* Slur Studio's own page: the name written, a song to press play on, then
   the daw in scenes — tidy, the transport, rubato, the doctor, the rough
   mix, the patch, its looks and your keys — worn in the daw's bauhaus look.
   The scenes draw themselves from the scroll (studioScenes.ts); this is only
   the page they are drawn on. */

const PAPER = '#F1ECDF', RED = '#D52B1E'

export default function StudioPage () {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => mountStudio(root.current!), [])

  return (
    <div className="sl ss" ref={root}>
      <div className="ss-grain" />
      <header className="sl-top static">
        <a className="sl-logo" href="/" aria-label="slur studio"><SlurMark height={40} /><span>studio</span></a>
        <PictoNav here="studio" />
      </header>

      {/* 0: the name written, and the song to be played */}
      <section className="ss-scene" id="intro"><div className="ss-stick">
        <svg id="staff" preserveAspectRatio="none" aria-hidden="true" />
        <SlurMark className="ss-name" height={150} arm="#1D4E9E" studio />
        <div className="ss-playrow">
          <button id="play" aria-label="play"><svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="37" fill={RED} /><path id="playTri" d="M 29 22 L 55 37 L 29 52 Z" fill={PAPER} /></svg></button>
          <div className="ss-readout">
            <span className="b" id="rB">1</span><span className="s" id="rS">.1.1</span><span className="t" id="rT">.001</span>
            <div className="ss-meter4" id="m4"><i /><i /><i /><i /></div><span className="ss-bpm">92 bpm</span>
          </div>
        </div>
        <div className="ss-hint">scroll</div>
      </div></section>

      {/* 1: tidy — the session as it came, then sorted */}
      <section className="ss-scene" id="tidy"><div className="ss-stick">
        <svg className="ss-full" id="tidySvg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" />
        <div className="ss-word ss-reveal" id="tidyWord"><h2>tidy</h2><p>every track heard for what it is, named and put in order</p></div>
      </div></section>

      {/* 2: the transport, as a poster */}
      <section className="ss-scene" id="transport"><div className="ss-stick">
        <svg className="ss-full" id="tpSvg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
        <div className="ss-word up ss-reveal" id="tpWord" aria-hidden="true"><h2>transport</h2></div>
        <p className="ss-tpcap">the place, the time, the meter, the tempo, the cycle and the out, in one column</p>
      </div></section>

      {/* 3: rubato */}
      <section className="ss-scene" id="rubato"><div className="ss-stick">
        <svg className="ss-full" id="rubSvg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" />
        <div className="ss-word high ss-reveal" id="rubWord"><h2>rubato</h2><p>pins on the sound, pulled along the time. voice, cut and beat ways</p></div>
      </div></section>

      {/* 4: the doctor */}
      <section className="ss-scene" id="doctor"><div className="ss-stick">
        <svg className="ss-full" id="docSvg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
        <div className="ss-word high ss-reveal" id="docWord"><h2>doctor</h2><p>the whole song heard at once. what crowds and what pokes out, named by its bars, with ways to fix it</p></div>
      </div></section>

      {/* 5: the rough mix */}
      <section className="ss-scene" id="rough"><div className="ss-stick">
        <svg className="ss-full" id="roughSvg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
        <div className="ss-word ss-reveal" id="roughWord"><h2 style={{ fontSize: 'clamp(56px, 10.4vw, 150px)' }}>rough mix</h2><p>one hearing, three mixes to start from. pick one and keep turning</p></div>
      </div></section>

      {/* 6: the patch */}
      <section className="ss-scene" id="patch"><div className="ss-stick">
        <svg className="ss-full" id="patchSvg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
        <div className="ss-word right ss-reveal" id="patchWord"><h2>patch</h2><p>patch on slur sits on every track. au and vst3 plug-ins go in the same patch</p></div>
      </div></section>

      {/* 7: the looks, the room itself */}
      <section className="ss-scene" id="looks"><div className="ss-stick">
        <div className="ss-shot" id="shot">
          <img className="a" src="/slur/studio/room-bauhaus.jpg" alt="Slur Studio, bauhaus" />
          <img className="b" id="shotB" src="/slur/studio/room-dark.jpg" alt="Slur Studio, dark" />
          <div className="ss-wipe" id="wipe" />
        </div>
        <div className="ss-word ss-reveal" id="looksWord"><h2 style={{ fontSize: 'clamp(54px, 11.8vw, 170px)' }}>looks</h2><p>the same room, worn another way</p></div>
      </div></section>

      {/* 8: your keys */}
      <section id="keys">
        <svg className="ss-arch" viewBox="0 0 1440 170" preserveAspectRatio="none" aria-hidden="true"><path d="M 0 170 C 0 40, 300 0, 720 0 C 1140 0, 1440 40, 1440 170 Z" fill="#1D4E9E" /></svg>
        <h2>your keys</h2>
        <div className="ss-sets" id="sets" />
        <div className="ss-caps" id="caps" />
        <div className="ss-say" id="keySay">press them</div>
        <div className="ss-note">the keys of logic pro, ableton live, cubase or pro tools. or your own set, read from your mac</div>
      </section>

      {/* 9: the end */}
      <section id="end">
        <SlurMark className="ss-end-mark" height={150} ink={C.ink} arm="#1D4E9E" studio />
        <div className="ss-acts"><span className="sl-pill ink">mac</span><span className="soon">soon</span></div>
        <div className="sl-foot-row plain">
          <a href="/terms">terms</a><a href="/privacy">privacy</a>
          <a href="mailto:wtsteven123@gmail.com?subject=copyright%20report">copyright</a>
          <span className="r">&copy; 2026 slur studio</span>
        </div>
      </section>
    </div>
  )
}

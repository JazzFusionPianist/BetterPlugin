import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import { parseXml } from '../../core/lib/miniXml.ts'
import { tempoMap, beatsToSeconds } from '../../core/lib/tempoMap.ts'
import { parseStudioOneSong } from '../../core/lib/projectStudioOne.ts'
import { parseAbletonSet } from '../../core/lib/projectAbleton.ts'
import { parseReaperProject } from '../../core/lib/projectReaper.ts'
import { parseDawproject } from '../../core/lib/projectDawproject.ts'
import { createRegionDawproject } from '../../core/lib/regionDawproject.ts'
import { projectKind } from '../../core/lib/projectRegions.ts'
import { dawprojectFixture } from './dawprojectFixture.mjs'

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

test('XML reader decodes entities, ignores DOCTYPE text and refuses internal subsets', () => {
  const x = parseXml('﻿<?xml version="1.0"?><!-- c --><A n="a &amp; &#x42;" m=\'q\'><B/><![CDATA[<C/>]]></A>')
  assert.equal(x.attrs.n, 'a & B'); assert.equal(x.attrs.m, 'q'); assert.equal(x.children.length, 1)
  assert.throws(() => parseXml('<!DOCTYPE a [<!ENTITY x "y">]><a/>'), /DOCTYPE/)
  assert.throws(() => parseXml('<a><b></a>'), /mismatched/)
  const skipped = parseXml('<a><Devices><x><y/></x></Devices><k/></a>', { skip: n => n === 'Devices' })
  assert.deepEqual(skipped.children.map(c => c.name), ['k'])
})

test('tempo ramps integrate exactly; holds stay piecewise constant', () => {
  const hold = tempoMap([{ beat: 0, bpm: 120, ramp: false }, { beat: 8, bpm: 60, ramp: false }])
  close(beatsToSeconds(hold, 8), 4); close(beatsToSeconds(hold, 10), 6)
  const ramp = tempoMap([{ beat: 0, bpm: 60, ramp: true }, { beat: 4, bpm: 120, ramp: false }])
  close(beatsToSeconds(ramp, 4), 60 * 4 / 60 * Math.log(2), 1e-9)
  close(beatsToSeconds(ramp, 6), 4 * Math.log(2) + 1)
})

test('project kind follows the file extension only', () => {
  assert.equal(projectKind('My Song.song'), 'studio-one'); assert.equal(projectKind('x.ALS'), 'ableton')
  assert.equal(projectKind('a.rpp'), 'reaper'); assert.equal(projectKind('a.dawproject'), 'dawproject')
  assert.equal(projectKind('a.cpr'), null)
})

const s1Song = `<?xml version="1.0" encoding="UTF-8"?><Song><Attributes x:id="Root"><Attributes x:id="timeContext" sampleRate="48000">
<TempoMap x:id="tempoMap"><TempoMapSegment curveType="0" start="0" end="1e200" tempo="0.428571428571428547638"/></TempoMap></Attributes>
<List x:id="Tracks"><MediaTrack mediaType="Audio" tempoFollow="2" trackID="{T1}" name="Kick &amp; Snare">
<SpeakerSetup x:id="trackFormat" type="Mono"/><List x:id="Events">
<AudioEvent clipID="{C1}" start="4" timeFormat="2" length="32" offset="4" name="Hit 1" speed="1" transpose="0" tune="0" normalize="0" modification="0"/>
<AudioEvent clipID="{C1}" start="1.5" timeFormat="0" length="0.25" name="Hit 2" speed="1" transpose="0" tune="0" normalize="1" modification="0"><Attributes x:id="volumeCurve" level="0.5"/></AudioEvent>
<AudioEvent clipID="{C1}" start="9" timeFormat="0" length="1" name="Stretched" speed="1.5" transpose="0" tune="0" normalize="0" modification="0"/>
</List></MediaTrack><MediaTrack mediaType="Music" trackID="{M}" name="Synth"/></List></Attributes></Song>`
const s1Pool = `<MediaPool><Attributes x:id="rootFolder"><MediaFolder name="Audio"><AudioClip mediaID="{C1}">
<Url x:id="path" type="1" url="file:///Volumes/Gone/Kick Take.wav"/><AudioTempoMap x:id="tempoMap" tempoApproved="1">
<AudioTempoMapSegment offset="0" tempo="0.428571428571428547638"/></AudioTempoMap></AudioClip></MediaFolder></Attributes></MediaPool>`

test('Studio One: beat and second events, media fallback, stretch rejection, gain note', () => {
  const s = parseStudioOneSong({ songXml: s1Song, mediaPoolXml: s1Pool, songPath: '/Songs/Demo/Demo.song' })
  assert.equal(s.sampleRate, 48000); assert.equal(s.tracks.length, 1); assert.equal(s.tracks[0].name, 'Kick & Snare')
  const [a, b, c] = s.regions
  close(a.startSeconds, 4 * 0.428571428571428547638); close(a.offsetSeconds, a.startSeconds); close(a.lengthSeconds, 32 * 0.428571428571428547638)
  assert.deepEqual(a.source.candidates, ['/Volumes/Gone/Kick Take.wav', '/Songs/Demo/Media/Kick Take.wav'])
  close(b.startSeconds, 1.5); close(b.lengthSeconds, 0.25); assert.deepEqual(b.notes, ['gain']); assert.equal(b.disabledReason, null)
  assert.match(c.disabledReason, /stretched/)
})

const alsXml = `<?xml version="1.0" encoding="UTF-8"?><Ableton MajorVersion="5" MinorVersion="12.0_12049"><LiveSet>
<Tracks><AudioTrack Id="8"><Name><EffectiveName Value="Kick"/><UserName Value=""/></Name><DeviceChain>
<Devices><PluginDevice Id="1"><Huge/></PluginDevice></Devices>
<MainSequencer><Sample><ArrangerAutomation><Events>
 <AudioClip Id="0" Time="8"><CurrentStart Value="8"/><CurrentEnd Value="9"/><Name Value="Kick A"/>
  <Loop><LoopStart Value="0.5"/><LoopEnd Value="3"/><StartRelative Value="0"/><LoopOn Value="false"/></Loop>
  <SampleRef><FileRef><RelativePath Value="Samples/Recorded/Kick.wav"/><Path Value="/Users/x/Proj/Samples/Recorded/Kick.wav"/></FileRef></SampleRef>
  <IsWarped Value="false"/><Disabled Value="false"/><PitchCoarse Value="0"/><PitchFine Value="0"/><SampleVolume Value="1"/></AudioClip>
 <AudioClip Id="1" Time="16"><CurrentStart Value="16"/><CurrentEnd Value="20"/><Name Value="Warped ok"/>
  <Loop><LoopStart Value="4"/><LoopEnd Value="12"/><StartRelative Value="0"/><LoopOn Value="false"/></Loop>
  <SampleRef><FileRef><Path Value="/a/Loop.wav"/></FileRef></SampleRef><IsWarped Value="true"/>
  <WarpMarkers><WarpMarker Id="0" SecTime="0.25" BeatTime="0"/><WarpMarker Id="1" SecTime="4.25" BeatTime="8"/></WarpMarkers>
  <SampleVolume Value="0.5"/><Fades><FadeInLength Value="0.1"/><FadeOutLength Value="0"/></Fades></AudioClip>
 <AudioClip Id="2" Time="24"><CurrentStart Value="24"/><CurrentEnd Value="28"/><Name Value="Stretched"/>
  <Loop><LoopStart Value="0"/><LoopEnd Value="4"/><StartRelative Value="0"/><LoopOn Value="false"/></Loop>
  <SampleRef><FileRef><Path Value="/a/S.wav"/></FileRef></SampleRef><IsWarped Value="true"/>
  <WarpMarkers><WarpMarker Id="0" SecTime="0" BeatTime="0"/><WarpMarker Id="1" SecTime="3" BeatTime="4"/></WarpMarkers></AudioClip>
</Events></ArrangerAutomation></Sample></MainSequencer></DeviceChain></AudioTrack>
<MidiTrack Id="9"/></Tracks>
<MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120"/><AutomationTarget Id="77"/></Tempo></Mixer></DeviceChain></MainTrack>
</LiveSet></Ableton>`

test('Ableton: unwarped seconds offsets, unity-rate warp, stretch rejected, device state skipped', () => {
  const s = parseAbletonSet({ xml: alsXml, setPath: '/Users/x/Proj/Song.als' })
  assert.equal(s.tracks.length, 1)
  const [a, b, c] = s.regions
  close(a.startSeconds, 4); close(a.lengthSeconds, 0.5); close(a.offsetSeconds, 0.5)
  assert.equal(a.source.candidates[0], '/Users/x/Proj/Samples/Recorded/Kick.wav')
  close(b.startSeconds, 8); close(b.lengthSeconds, 2); close(b.offsetSeconds, 0.25 + 2)
  assert.deepEqual(b.notes.sort(), ['fade', 'gain'])
  assert.match(c.disabledReason, /time-stretched/)
})

const rpp = `<REAPER_PROJECT 0.1 "7.22/macOS-arm64" 1700000000
  SAMPLERATE 44100 0 0
  TEMPO 97 4 4
  <TRACK {AAA}
    NAME "Kick"
    TRACKID {AAA}
    <ITEM
      POSITION 2.5
      LENGTH 0.75
      FADEIN 1 0.01 0 1 0 0 0
      MUTE 0 0
      IGUID {I1}
      NAME "kick hit"
      VOLPAN 1 0 1 -1
      SOFFS 1.25
      PLAYRATE 1 1 0 -1 0 0.0025
      <SOURCE WAVE
        FILE "Audio/kick take.wav"
      >
    >
    <ITEM
      POSITION 5
      LENGTH 1
      IGUID {I2}
      NAME "take a"
      SOFFS 0
      <SOURCE WAVE
        FILE "/abs/a.wav"
      >
      TAKE SEL
      NAME "take b"
      SOFFS 0.5
      <SOURCE WAVE
        FILE "/abs/b.wav"
      >
    >
    <ITEM
      POSITION 9
      LENGTH 1
      IGUID {I3}
      PLAYRATE 2 1 0 -1 0 0.0025
      <SOURCE WAVE
        FILE "/abs/c.wav"
      >
    >
  >
>`

test('REAPER: seconds positions, active take, rate change rejected', () => {
  const s = parseReaperProject({ text: rpp, projectPath: '/P/Song/Song.rpp' })
  assert.equal(s.sampleRate, 44100)
  const [a, b, c] = s.regions
  close(a.startSeconds, 2.5); close(a.offsetSeconds, 1.25); close(a.lengthSeconds, 0.75)
  assert.equal(a.source.candidates[0], '/P/Song/Audio/kick take.wav'); assert.deepEqual(a.notes, [])
  assert.equal(b.name, 'take b'); close(b.offsetSeconds, 0.5); assert.equal(b.source.candidates[0], '/abs/b.wav')
  assert.match(c.disabledReason, /Rate-changed/)
})

test('DAWproject: reads back the qualified Slur writer exactly (round trip)', async () => {
  const fixture = await dawprojectFixture()
  const file = await createRegionDawproject(fixture)
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const s = parseDawproject({ projectXml: strFromU8(zip['project.xml']), projectPath: '/x/Slur Regions.dawproject', entries: Object.keys(zip) })
  assert.equal(s.regions.length, 3)
  for (const [i, r] of s.regions.entries()) {
    const src = fixture.bundle.regions[i], asset = fixture.bundle.assets.find(a => a.id === src.assetId)
    close(r.startSeconds, src.start.samples / src.start.sampleRate, 1e-9)
    close(r.offsetSeconds, src.offsetFrames / asset.sampleRate, 1e-9)
    close(r.lengthSeconds, src.lengthFrames / asset.sampleRate, 1e-9)
    assert.equal(r.disabledReason, null)
    assert.match(r.source.embedded, /^audio\/[a-f0-9]{64}\.wav$/)
  }
  assert.deepEqual(s.tracks.map(t => t.name), ['Drums & One', 'Keys <Two>'])
})

test('DAWproject: beat timeline with unity warps; stretched warps rejected', () => {
  const xml = `<Project version="1.0"><Application name="Bitwig Studio" version="5.2"/><Transport><Tempo unit="bpm" value="90"/></Transport>
  <Structure><Track id="t1" name="Gtr" contentType="audio"><Channel audioChannels="2"/></Track></Structure>
  <Arrangement><Lanes timeUnit="beats"><Lanes track="t1"><Clips id="c">
   <Clip time="6" duration="3" playStart="0"><Warps timeUnit="beats" contentTimeUnit="seconds"><Audio channels="2" sampleRate="48000"><File path="audio/g.wav"/></Audio>
    <Warp time="0" contentTime="1"/><Warp time="3" contentTime="3"/></Warps></Clip>
   <Clip time="12" duration="3"><Warps timeUnit="beats" contentTimeUnit="seconds"><Audio><File path="audio/g.wav"/></Audio>
    <Warp time="0" contentTime="0"/><Warp time="3" contentTime="4"/></Warps></Clip>
  </Clips></Lanes></Lanes></Arrangement></Project>`
  const s = parseDawproject({ projectXml: xml, projectPath: '/x/a.dawproject', entries: ['project.xml', 'audio/g.wav'] })
  const [a, b] = s.regions
  close(a.startSeconds, 4); close(a.lengthSeconds, 2); close(a.offsetSeconds, 1); assert.equal(a.disabledReason, null)
  assert.match(b.disabledReason, /stretched/)
})

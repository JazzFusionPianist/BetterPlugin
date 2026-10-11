# Slur Tap capture cache (format v1)

Slur Tap is the fallback for hosts where Slur cannot ask the DAW to render other
tracks (no PTSL/ReaScript) and cannot read region layouts from a project file.
It is a zero-latency pass-through insert placed on each source track (last in
the chain). It never changes audio. While the DAW plays, records, or renders
offline, it stores what it hears together with the host timeline position.
A single offline master bounce therefore fills every tapped track at once, faster
than real time. The main Slur instance then assembles stems or regions for any
captured range without a further pass.

Writer: `Plugin/Source/Tap/TapCache.cpp` (C++). Reader: `src/tapCache.mjs`.
Root: `~/Library/Application Support/Slur/Tap/` (directories 0700, files 0600).

## Registry `taps/<tapId>.json`

Rewritten atomically (tmp + rename) about once per second while the plug-in is
loaded, and immediately after a track rename:

```json
{ "version": 1, "tapId": "<uuid>", "generation": "<uuid>",
  "hostKey": "pid:1234", "host": "Logic Pro",
  "track": "Kick In", "colour": "#ff2a2a", "sampleRate": 48000, "channels": 2,
  "heartbeatMs": 1760000000000, "cacheFull": false, "dropped": 0 }
```

* `tapId` and `generation` persist in the plug-in state, so reopening a project
  keeps its captures. A sample-rate or channel-count change starts a new generation.
* `track` comes from the host (`updateTrackProperties`: AU ContextName in Logic,
  VST3 channel context, AAX). Missing names fall back to "Slur Tap N" in the UI.
* A registry older than 15 s is stale: the plug-in instance is gone.

## Audio pages `cache/<tapId>/<generation>/page-<n>.f32`

`n = floor(sample / 65536)`. Each page holds 65536 frames of interleaved
little-endian float32 at the registry rate and channel count, written in place.
Absolute frame `s` lives at byte `((s mod 65536) × channels) × 4` of its page.
Negative (pre-roll) samples are not stored. Pages are sparse; never assume a
byte is valid without coverage.

## Coverage `cache/<tapId>/<generation>/coverage.json`

```json
{ "version": 1, "sampleRate": 48000, "channels": 2, "pageFrames": 65536,
  "spans": [[0, 1440000, 1760000000000], [2880000, 2900000, 1760000005000]] }
```

Half-open `[start, end)` frame spans that were actually written, sorted and
non-overlapping, each with the OLDEST write time inside it (adjacent writes
within 60 s merge). A later write over a span replaces that portion. The reader
must refuse a range that any selected track does not fully cover. It never
invents silence for unplayed audio.

## Guarantees and limits

* Real-time playback: if the disk writer falls behind, blocks are dropped and
  simply stay uncovered (`dropped` counts them); the audio path never waits.
* Offline render (`isNonRealtime`): the audio thread waits for queue space, so
  an offline bounce is captured completely.
* Captures reflect the audio when it was played; edits made afterwards are not
  visible until that range is played or bounced again. The UI shows capture age.
* Upstream plug-in latency is compensated by the host at the mix point, not
  mid-chain; place Slur Tap last on the track.
* Per-tap cache cap: 4 GiB (`cacheFull` stops further writes). Caches of taps
  unseen for 30 days are deleted by any newly loaded Slur Tap.

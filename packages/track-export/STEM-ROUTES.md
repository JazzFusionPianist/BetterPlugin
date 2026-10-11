# Stem routes: track bounce vs. region share (2026-10-12)

Two separate features, each with its own picker in Slur chat:

| Feature | What is sent | Receiver gets |
| --- | --- | --- |
| **Track bounce** (`ExportTracksButton`) | Processed, equal-length stems of whole tracks over one range | One WAV per track + common start position |
| **Region share** (`ShareRegionsButton`) | The ORIGINAL audio of each selected region, plus that region's own timeline position, source offset and length | A region bundle the receiver can drop back at the same positions (split kicks keep every hit's place) |

Rule: a satellite-free route is always used first. Slur Tap (a pass-through
insert per track) is only the fallback where the host offers nothing else.
Policy: `packages/core/lib/stemRoutes.ts` (`trackRoutes`, `regionRoutes`).

## Per-host matrix

| Host | Track bounce | Region share |
| --- | --- | --- |
| Pro Tools | PTSL offline bounce | (native drag works) → Slur Tap |
| REAPER | ReaScript offline render (`Slur REAPER Bridge.lua`) | Live item layout via the bridge (no save) → saved `.rpp` → Slur Tap |
| LUNA | Slur Tap | LUNA local service → Slur Tap |
| Studio One / Fender Studio Pro | Slur Tap | Saved `.song` (read directly, no export) → DAWproject → Slur Tap |
| Ableton Live | Slur Tap | Saved `.als` (read directly) → Slur Tap |
| Cubase / Nuendo / Bitwig | Slur Tap | DAWproject export (File › Export › DAWproject, linked once) → Slur Tap |
| Logic Pro, FL Studio, others | Slur Tap | Slur Tap (regions found from captured audio, effects included) |

Logic and FL Studio project files are proprietary binaries; Logic has no
scripting API for track rendering (see BACKGROUND-EXPORT.md) and blocks drops
on plug-in windows. Slur Tap is therefore their only route.

## Project-file regions (`src/projectRegions.mjs`, parsers in `packages/core/lib/project*.ts`)

* The plug-in owns the linked path (native file chooser, or a helper suggestion
  picked by index) and persists it in the DAW session. The page never supplies
  a path. Suggestions: Spotlight, newest first, excluding autosave/backup folders.
* Positions are the saved arrangement, in seconds from song zero; beat-timed
  formats are converted through the tempo map (ramps integrated exactly).
* Each referenced source is read once and cropped to the union span of the
  selected regions that use it; regions keep their own offset/length into it.
  WAV (incl. EXTENSIBLE) and AIFF/AIFC (none/sowt/fl32) are supported.
* Timing/pitch edits disable a region (stretch, warp ≠ unity, transpose,
  reverse, rate change, Audio Bend, loops beyond the source). Gain/fade/envelope
  edits are allowed and listed as "not applied".
* Revision = project digest + source sizes; a save between listing and sending,
  or during capture, aborts without attaching anything.
* Qualified on real files: four Studio One 6/Studio Pro 8 songs on the QA Mac
  (positions, offsets, media paths). Ableton, REAPER `.rpp` and DAWproject are
  covered by schema-based synthetic tests and a DAWproject round trip through
  Slur's writer; Live and REAPER are not installed on the QA Mac.

## REAPER bridge (`native/Slur REAPER Bridge.lua`, `src/reaperBridge.mjs`)

Startup ReaScript installed by `install.mjs` (replaces the older Orb adapter
block in `__startup.lua`). Private file IPC in
`~/Library/Application Support/Slur/HostControl/reaper`. Render: selected tracks
as stems (24-bit WAV), custom bounds = exact range, no tails, project rate;
every render setting and the track selection are restored. Outputs are mapped
by `slur-$tracknumber` → track GUID and validated (rate, length ±1 frame).
Not yet verified against a real REAPER (not installed on the QA Mac).

## Slur Tap (`Plugin/Source/Tap`, `src/tapCache.mjs`, format in TAP-CACHE.md)

Zero-latency pass-through AU/VST3. Captures while the host plays, records or
renders offline, indexed by timeline sample; one offline mix bounce fills
every tap. Track names come from the host (AU ContextName, VST3, AAX). Main
Slur lists live taps in the same host, shows per-track capture coverage/age,
refuses ranges not fully captured (never pads with silence). Track bounce range:
captured extent or the DAW loop/cycle (from the main plug-in's play head,
constant tempo assumed). Region share: audible spans (−66 dBFS, ≥0.75 s gaps).
C++ writer ↔ JS reader contract test: `test/tapCache.test.mjs` with
`Plugin/Tests/TapCacheTest.cpp`.

## Rejected alternatives

* Separate drop-shelf helper app for drag-blocked hosts: rejected by the user
  (workflow). Export-dialog UI automation: retired earlier (BACKGROUND-EXPORT.md).
* Multi-input sidechain collector: Logic/Live allow one sidechain; routing-heavy.

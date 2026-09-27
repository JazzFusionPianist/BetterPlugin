# Cross-DAW region sharing direction

2026-09-25 — product direction, not a shipped compatibility claim.

## LUNA native region increment (2026-09-27)

LUNA now has a separate region picker/capture and exact-position restore action
through its local service. This does not depend on external timeline dragging,
does not enable LUNA whole-track export, and is not universal drag support.
The synthetic host round trip preserved three placements and selected PCM.
See `LUNA-REGIONS.md` for the implemented subset and remaining qualification.

## DAWproject destination increment (2026-09-26)

Known layouts now have an audio-only DAWproject conversion and native drag
preparation path in Studio chat. Unknown file-drop positions cannot use it.
Cubase 15 and Fender Studio Pro 8 synthetic file-import/readback tests preserve
positions/trims/audio, with host-specific limitations. See
`DAWPROJECT-REGIONS.md` for exact qualification boundaries. This is NOT completion
of cross-DAW native region capture or single-drop current-session restoration.

## Implementation update (2026-09-26)

- Production track picker/native job allowlists restricted to Pro Tools;
  Standalone can connect to Pro Tools. Historical Logic/LUNA modules remain
  as research/test code, not advertised callable adapters.
- Studio chat's DAW audio drops now carry a region manifest, retain repeated
  occurrences, deduplicate identical uploads, and reject partial send failures.
- Original BWF/iXML recording clocks survive separately from edited positions;
  unknown edited positions remain null and are not labelled as exact placement.
- No automatic merge on timestamps; explicit merge tools remain available.
  Studio Files no longer auto-pads uploads to bar one.
- Slur archive save/re-attach preserves IDs, trims and verified layouts if
  present. Legacy `.orb-regions.zip` remains readable. This is a Slur transfer
  archive, NOT a format every DAW can directly import.
- Newer remote web UIs must advertise the region-sharing and Pro Tools-only
  contracts before replacing the embedded UI; this prevents incompatible
  newer deployments from silently dropping features again.
- Unit tests: 33 pass, 8 unrelated visual-worker tests skipped. Frontend build
  passes. Universal Slur 1.0.17 AU/VST3/Standalone built, Developer ID signed and
  installed; installed executable hashes match build artifacts. AU validation
  succeeds. Standalone loads the carried page and reaches login. Live chat
  transfer and cross-DAW gestures have not been verified on this build.
- Pro Tools-only native helper updated. AAX was built but NOT installed: PACE
  wraptool reports MissingFusionToolsLicense. The previously working AAX is
  unchanged. Previous AU/VST3/Standalone/helper are recoverable under
  `~/Library/Application Support/Slur/Backups/region-sharing-20260926.Hkt66R`.
- Collaborator main through `71b664d` is merged; no remote main deployment was
  made. Local feature commit: `070e9ba`; collaborator merge: `3056873`.

Not implemented: verified edited positions from arbitrary native drag payloads,
tempo-map transfer, cross-DAW one-drop layout reconstruction, or a live two-user
network transfer test. Do not describe this groundwork as complete restoration.

## Scope

- Track enumeration and selected-track export: Pro Tools only. Preserve the
  verified PTSL flow. Retire other host export paths from production capabilities
  and UI in a separate tested implementation; this document does not change them.
- Shared product direction across hosts: transfer selected audio regions and
  their layout, including cross-host exchanges, without exporting whole tracks.
- Continue honoring the no DAW export-window/focus-takeover requirement.

## Existing code versus required behavior

`packages/core/lib/regionBundle.ts` models assets separately from occurrences,
track membership, sample-based start, source offset and length. It keeps repeated
uses of the same asset. `prepareRegionBundle` does NOT infer layout from a file:
it currently leaves source, track and start unknown. `planRegionImport` plans
placements but does not execute DAW edits.

`DragMonitor.mm` supports native file drags/promises. The Cubase XML handler
extracts source filenames, not complete edited event layouts. Drag-out currently
offers file URLs. Those URLs alone do not tell a destination DAW how to recreate
the project arrangement. Pro Tools timeline drags were previously observed by
the user to move clips inside Pro Tools rather than create an external drag.
No common schema can manufacture an external drag that the source host never
provides, or make a destination consume placement metadata it ignores.

## Architecture

    source DAW drag → host-specific capture → validated Slur region bundle
                                                      ↓
                                                   chat
                                                      ↓
    destination DAW ← qualified importer/drag payload ← received bundle

Shared transport is host independent. Capture and restoration capabilities are
host specific and must be qualified separately; the sender/receiver do not have
to use the same DAW when both ends support the contract. No dependency on
matching plug-in instances, saved project paths or the sender's track IDs in the
receiver project.

## Position contract

- Store the CURRENT edited event position with its evidence source, distinct
  from original recording timestamps and transport/playhead position.
- Preserve occurrence IDs, track order/name, start, source offset, duration,
  channel layout and sample rate. Deduplicate assets, never occurrences.
- Define song zero separately from SMPTE project origin and bar-number offsets.
- Future schema version: optional tempo/meter maps and PPQ positions with
  explicit completeness. A current BPM snapshot is not a tempo map.
- Default proposal: preserve elapsed time from source song zero. Different
  sample rates use rational conversion, rounded once at the destination.
- Musical/bar alignment is a separate mode requiring the source and destination
  tempo maps. Never overwrite the receiver's tempo map or stretch audio silently.
- Missing positions remain unknown; do not substitute the playhead, file
  creation time, or an unverified recording timestamp.
- Gain, fades, reverse, stretch and processing require explicit representation
  or a correctly rendered clip. Source-file copying is not necessarily the audio
  heard in the arrangement. Do not promise instrument/MIDI conversion here.

## Restoration contract

Standard file drop and exact layout restoration are different operations.
Metadata-bearing WAV can preserve timestamps, but ordinary dropping need not
place it at that timestamp. AAF/DAWproject/native clip formats are candidates
only for hosts whose actual import behavior has been tested; none is a universal
drag format. A host-bound importer may be appropriate where a supported API
exists. Do not bring back export-dialog automation as an implied fallback.

Use new destination tracks by default for a multi-track bundle, with explicit
mapping if reusing existing tracks. Require a project-bound snapshot, bounded
assets and verified destinations. Do not publish a partial bundle on upload
failure or declare restoration successful without confirmed placements. Retain
the received audio if placement fails so users do not lose the shared content.

## Qualification gates

Before calling a source/destination pair supported, test multiple tracks and
regions, gaps, overlaps, trims, repeated assets, duplicate names, moved clips,
44.1/48 kHz conversion, project start offsets, tempo changes, and interrupted
transfers. Verify sample placement and actual audio, not only filenames.
Start by observing real native drag payloads on synthetic sessions. Report
file-only transfer, exact capture and exact restoration as separate capabilities.

Revisit schema versioning when tempo/edit semantics are specified, and host
compatibility only after both capture and restore pass. No claim of universal
drag-out support or universal drop-at-original-position is justified today.

# LUNA native region transfer

2026-09-27. This adapter does not require dragging a region into the plug-in.
It is separate from Pro Tools-only whole-track export.

## User flow and boundaries

Slur's composer region button → LUNA audio-region list → select occurrences →
crop selected source PCM + attach the existing region bundle → recipient's
“restore in LUNA…” → named destination confirmation → new tracks at original
sample positions. The receiver can accept a complete bundle captured by a
different DAW; unknown file-only positions cannot enable restoration.

Uses LUNA's loopback service on port 4718 (the existing LUNA adapter transport),
not screenshots, accessibility, export dialogs, playback capture or StemLink.
The running service's self-described command schemas were inspected before use.
This host-version-dependent interface is not promised as a stable public SDK.
Only LUNA/Standalone expose the native region operation. No other DAW's track
export capability is enabled, and there is no silent automation fallback.

## Contracts

- Capture reads active audio playlists, stable clip/track IDs and get_clip_info.
  Source offsets come from source nanoseconds on the actual source sample grid;
  timeline placement comes from compiled current song samples. No BWF/playhead
  inference. Region names, track names/order and repeated occurrences survive.
- A before/after session fingerprint binds selection to the inspected project.
  Local source media must resolve inside its session package, be bounded and
  match inspected WAV metadata. Only selected PCM is copied into the archive.
  File metadata/private source paths are not uploaded. Transfers cap at 300 MB.
- Import validates archive paths, hashes, metadata, layout and trims before any
  host mutation. Media are copied with workspace/import_file local_copy, then
  new time-based tracks and clips are created with explicit nanoseconds. The
  receiver's tempo map is never changed. Selection is not replaced.
- Readback verifies source trim, destination samples, channels and copied audio
  hashes. A different-rate source may have a derived LUNA playback cache; the
  original PCM is retained, not replaced with the resampled cache.
- Import creates a private journal and uses an exclusive LUNA transfer lock.
  Uncertain writes retain the lock/journal; no blind retry, Undo or deletion.
  Partial failures may leave new tracks/media and are reported as incomplete.
- Unsupported: MIDI/instruments, overlapping/layered or partially compiled
  clips, edited gain/fades, pitch/stretch, loops, ARA and clip effects. Track
  mixer/insert effects are not rendered by audio-region sharing. These are
  explicit limits, not a claim of audible-session equivalence.

## Verification

Real LUNA 3.0.0 synthetic round trip (no chat uploads): 2 new tracks, 3 regions,
48 kHz mono + 44.1 kHz stereo in a 48 kHz session. Positions 120000, 384001,
72000; trims 24000/24000/11025 source frames; lengths 36000/36000/44100.
After insertion, capture read the same positions and byte-identical cropped
WAVs. Repeated mono occurrences remained separate. Fixture session only:
`Slur Region QA 2026-09-27` under the system temp directory.

Reproduce with `node --experimental-strip-types packages/track-export/test/liveLunaRegions.mjs`.
The script refuses any other session name and adds new synthetic tracks on each
run; it never cleans up by deleting tracks or alters user projects. UI testing
and two-user delivery are separate gates from the verified host round trip.

Unit checks include malformed/unsupported clip evidence, rational time
conversion, SRC-cache distinction, stale selection/session changes, playback,
corrupt media, overlap rejection before writes and interrupted-import journals.

## Trade-offs / revisit

Direct host transfer supplies missing drag metadata, but requires a per-host
adapter and currently uses an explicit region picker/restore action. It does
not claim a drag gesture LUNA does not provide. Source scanning is bounded but
serial; revisit pagination and bulk queries for larger sessions. Revisit edits,
tempo/meter-map versioning, public API availability and host-version conformance
before broader distribution. General DAW restoration remains incomplete.

## Local installation

Code `e1b0f48`, Slur 1.0.21: universal AU/VST3/Standalone built, Developer ID
signed and installed. AU validation succeeded. 51 tests passed, 8 unrelated
visual tests skipped, no failures. Installed helper inspection/capture also
returned the three expected sample positions (120000, 384001, 72000).
LUNA's timeline UI displayed the synthetic restored tracks/regions. Actual
two-user chat delivery has not been run for this adapter.

Previous bundles: `~/Library/Application Support/Slur/Backups/luna-regions-121-9UfBCcdV`.
Previous helper: `~/Library/Application Support/Slur/Backups/luna-regions-helper-A1PgFEWG`.
The working AAX was not replaced; no remote Git push or Vercel deployment.

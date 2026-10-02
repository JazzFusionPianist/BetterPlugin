# Original-position placement

## Contract and flow

Received bundle → selected occurrences → shared download cache → hash-checked archive
→ native host allowlist → local helper/host lock → new tracks → timeline readback.

The button is offered in Pro Tools and LUNA only for a complete region bundle.
Old `bar …` text, BWF recording timestamps and the transport cursor are not trusted
placement evidence. Standalone does not guess which running DAW is the destination.
The ordinary download and drag controls remain available independently.

## Position semantics

Preserve elapsed time from source song zero, sample-rate converted with integer
rounding. Pro Tools placement accounts for the destination's sample origin obtained
by converting its session start time. New tracks use sample timebase. Neither host
adapter overwrites the destination tempo map: the same bar/beat is NOT promised
when tempo maps differ. Mono/stereo non-overlapping audio only, 298 MiB archive cap.

Individual row actions project the manifest to that specific region occurrence,
not every region sharing the source file. Cropping materializes source trims before
import so repeated occurrences can be placed independently on one new track.

## Safety and reliability

- UI reservations survive disclosure unmounts and block row/batch double execution.
  Completed/uncertain placements stay reserved for this webview lifetime; reload
  to deliberately place the same material again, after checking the destination.
- Account changes cancel preparation before the host request. An already issued
  host mutation cannot be safely cancelled by closing a card.
- Inspect destination before downloading, then validate the session ID, sample rate,
  stopped transport and time origin repeatedly inside the helper.
- Validate hashes, metadata, channel layout and overlap before host mutations.
- Pro Tools uses ImportAudioToClipList, CreateNewTracks and SpotClipsByID; never
  selection-driven commands. Imported files must reside inside the session.
- Pro Tools EDL readback verifies all new channel clips and detects unexpected ones.
  LUNA verifies region info and copied audio hash using its existing adapter.
- Pro Tools shares the existing host-mutation lock with track export. Partial host
  failure keeps the lock and an incomplete job journal. No automatic retry, Undo,
  deletion or modification of pre-existing tracks.

## Trade-offs / qualification

Native host adapters provide better reliability than mouse automation but are
version-dependent. Pro Tools implementation is tested against mocks matching the
locally licensed 2026.4 protocol. Live Pro Tools qualification remains pending:
on 2026-09-28 its current process timed out both PTSL registration (60s) and UI
inspection. Do not describe mock success as successful placement in Pro Tools.
The LUNA adapter had prior synthetic-session readback qualification; this change
reuses it. UI and installer verification are separate from audio-host qualification.

Revisit persistent per-destination receipts (currently webview lifetime), large-file
streaming, source-to-destination tempo-map policy, surround formats, and host version
capability discovery as adoption grows. Other hosts retain Drag to DAW; no promise
that arbitrary drops honor original positions.

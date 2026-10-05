# Logic drag position metadata

## Implemented

Slur's native drag monitor identifies Logic region drags using the region pasteboard type,
not merely the current host. On drag entry the frontend asks the existing approved Logic
helper for a read-only selection snapshot. After the audio file promises finish, a second
snapshot must agree on project, selected region names, tracks and musical positions.
No AAF export, menu action, dialog automation or timeline edit is used by this path.

Promised files are matched by normalized region/file name, not completion order. A changed
selection, duplicate selected names, renamed/missing audio or incomplete selection rejects
the batch. Finder imports do not receive fabricated source positions.

The v1 manifest preserves `musicalStart` and `musicalEnd` as Logic's 1-based bars, beats,
divisions and ticks, plus original track names/order. The private project URL is hashed
before entering the manifest. Chat, Files and archive re-sharing retain this data.
The Logic receiver still drags ordinary audio files, without automating import dialogs.

## Qualification boundary

- Requires the updated native Slur plug-in, frontend, DAW bridge runtime and already
  authorized Logic companion. The frontend update marker prevents an older remote page
  from replacing this build's bundled page.
- Current reader requires a saved project, stopped transport and the qualified English
  Logic accessibility descriptions. Permission changes are never made automatically.
- AX musical positions are not sample-accurate source time. `start` remains null; no
  playhead position, file recording timestamp or constant-tempo guess is substituted.
- The source division denominator is presently unknown and stored as null. Displayed
  positions are preserved, but sample-based AAF/VST/Pro Tools restore remains disabled
  for these manifests. PTSL musical conversion needs separate host qualification, including
  tick units, meter/division changes, song-start offset and tempo changes.
- Previous audio-only messages cannot recover lost edited positions. Re-drop the source
  regions after updating.

## Tests

`packages/daw-bridge/test/logicRegionDrop.test.mjs` covers selected-only extraction,
out-of-order completion, ambiguous/changed selections, malformed positions, private
upload-reference round trips, archive re-sharing and retention without false sample times.

`apps/plugin/tests/region-bundle.html?native&host=logic` provides an isolated native-protocol
double with a Test musical drop action. It does not call a DAW or upload to a real chat.

Local verification on 2026-10-03: Slur AU/VST3 built and installed, code signatures
verified, and the installed AU binary matched the build hash. The existing Logic test
project's selected stereo regions were read twice without edits, yielding stable starts
`1.3.1.11` and `2.1.1.11`. The isolated browser test exercised the native-protocol hook,
audio probe, manifest upload/receive double and visible musical-position rendering at
600px and 320px widths, without runtime errors or horizontal overflow. No live chat
message/file was sent, and a complete live drag-to-recipient test remains outstanding.

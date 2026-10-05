# Orb Region Bundles: Implementation Status

This is an experimental Pro Tools integration and Logic AAF export path with native Orb controls.
Node 22.6+ is required. Pro Tools also needs the separately licensed Avid Pro Tools Scripting SDK.
The SDK and its documents are not included in the repository.

## Pro Tools track export (2026-09-22)

Slur Chat, the legacy chat composer, and the Stems file picker now include an
**Export tracks** button when the native Pro Tools bridge is available. It reads
real track IDs/names with `GetTrackList`, lets the user select multiple tracks and
one shared range, calls `BounceTrack` offline for each track, and feeds a validated
audio/layout archive into the existing conversation attachment path. No StemLink,
screen automation, playback capture, temporary session tracks, solo changes or
routing changes are used. Each job has a private output directory and journal.

The shipped 2026.4 host requires `audio_info: {}` and a trailing separator on the
output directory. It accepts `file_name` although the SDK schema calls that field
`file_name_prefix`; both are supplied. Do not remove these compatibility details
without a real-host regression test. Actual WAV format, duration, output path and
hashes are checked before attaching; a failed/partial export never yields an archive.

Current limits:

- Mono/stereo audio, instrument, aux and routing-folder tracks; up to 64 selected
  tracks and 300 MB per native transfer. Render encoding follows Pro Tools' Track
  Bounce settings and is inspected, not assumed. Split-mono output is rejected.
- Entire session means session start to the last audio timeline clip, **not** the
  session's default 24-hour maximum. The exact range is displayed before export.
  If MIDI/instrument clips are present, this automatic end estimate is disabled:
  select the full song in Pro Tools and use Timeline selection instead.
- Timeline selection uses the exact displayed bounds; changes require refreshing.
  Select a longer range explicitly for effect tails. Shared aux returns and master
  processing are not automatically added to each track. Hardware inserts and every
  plugin/automation combination are not qualified for offline rendering.
- Busy exports cannot be retried concurrently. Changing chats discards the pending
  attachment rather than sending to another conversation. A native timeout leaves
  the transfer lock/journal for inspection rather than silently retrying a bounce.

Verification: 7 focused unit tests plus the existing suite; real Pro Tools 2026.4
48 kHz test session bounced the whole 0–96000-sample range and the 24000–72000-sample
selection, verified WAV lengths and bundle positions, and confirmed original
tracks/timeline were unchanged. The native standalone UI → helper → Pro Tools →
attachment-validator path also passed using `tests/track-export.html` (no network
upload). Production chat delivery, release deployment and PACE-signed installation
of this change have **not** been verified/completed.

Run the guarded real-host test only with the named synthetic QA session open:

```sh
ORB_PTSL_SDK=/path/to/licensed/sdk node --experimental-strip-types packages/daw-bridge/test/liveProToolsTrackExport.mjs
```

`ORB_REGION_QA=tracks` enables the native UI fixture in the local Vite server.
This fixture does not send chat messages or upload files. Build/install the local
helper with `install.mjs` after changes; deployed plugins also need the updated
native `DawRegionBridge` and matching frontend. Do not publish unrelated in-progress
region/Logic integration changes merely to deploy this button.

## Logic Pro Status (2026-10-03)

**The requested native one-drag workflow is not implemented. The dialog-driven
restore workaround was rejected and is disabled.** The attachment no longer arms
a marker drag or advertises restoration readiness. Native `armLogic`,
`prepareLogic` and `dropLogic` requests fail closed; the installed worker also
rejects stale requests before opening the companion. Existing bundles, source
layout metadata, explicit AAF export and Pro Tools transfers remain available.
No consolidation, synthetic silence or per-region file-drop substitute is enabled
as if it fulfilled original-region restoration.

Apple documents a native multi-file drop with an **Add Files to Tracks** dialog,
and **Edit > Move > To Recorded Position** as a separate operation for timestamped
audio. These do not establish dialog-free, track-grouped restoration:
[native drop](https://support.apple.com/en-qa/guide/logicpro/lgcpd1e675e5/mac),
[recorded position](https://support.apple.com/en-euro/guide/logicpro/lgcpf7c0d489/mac).
A future adapter needs a demonstrated host insertion interface that retains each
region, track grouping and sample position without UI automation. File drops or
BWF timestamps alone must not be advertised as that adapter.

The AAF converter and experimental selection-capture adapter remain implemented.
Accessibility was granted and real AX selection
inspection passed. A manual AAF capture/import/readback round trip also passed
for four tracks and six regions. Developer ID-signed rebuilds now retain the
approved Accessibility permission. Automatic capture now passes in the real AU:
eight mono/stereo tracks and twelve selected regions were captured into one
validated Orb archive without manual intervention in the AAF dialogs. The
helper uses focused, project-bound HID key sequences for Go to Folder/Return;
process-targeted events did not operate Logic's save dialog. Keys are limited
to those two commands, with focus checks and modifier-release cleanup.
The selection comparison now ignores JSON property order while rejecting real
content/selection changes. Do not present this capture test or the manual round
trip as completed native drag restoration. Cross-DAW combinations are unqualified.
A normal Logic audio drop still lacks a verified source manifest: source capture
is currently an explicit **Share selected Logic regions** button, not an automatic
interception of incoming Logic drags.

### Experimental companion

`node packages/daw-bridge/install-logic.mjs` builds the local macOS app at
`~/Applications/Orb Logic Bridge.app`. The user must grant Accessibility manually.
Set `ORB_CODESIGN_IDENTITY` to the same Developer ID identity on each rebuild to
retain a stable signed identity. Without it the installer uses ad-hoc signing,
which can require renewed approval after every binary change. The installer never
modifies TCC permissions. `install.mjs` installs the matching Node/Python worker.

The helper accepts only private, expiring jobs under `DawBridge/Jobs`, targets
`com.apple.logic10`, requires one saved project and stopped transport, and checks
the expected project before actions. The current menu/AX adapter is English-only
and must fail closed for unrecognized layouts or dialogs. AAF import can open an
additional media-copy dialog in some configurations; this remains unqualified
and is intentionally not accepted blindly. No arbitrary menu or script is accepted.

Capture exports AAF locally, compares the AX snapshot before/after, and joins
unique track names and strictly ordered full region lists against AAF counts.
Sample positions come from AAF, never from rounded AX ticks. Only selected audio
ranges enter the archive; unselected backing-WAV portions and the project path
are not transmitted. Audio is exchanged as 24-bit WAV without dithering, not a
claim to preserve arbitrary processed/float source essence. Duplicate track
names, ambiguous/sub-tick ordering, MIDI, overlaps, gain/fades and unsupported
media fail before a bundle is sent. The temporary local AAF can contain the whole
project, but only validated selected regions are attached to the chat.
The export rate is supplied by the native AU and explicitly selected in Logic's
AAF dialog. The retired restoration prototype required matching project/bundle
sample rates and rejected a rate change between preparation and release.

The retired prototype prepared a private marker and AAF. On release,
the companion checked the actual screen hit target belonged to the same Logic
project's track lane. Escape, other apps, plug-in windows and invalid targets
must not import. New tracks receive an `[Orb <id>]` suffix for unambiguous
readback. Success requires Logic's exported AAF to match positions, lengths and
source trims and existing AX track contents to remain unchanged. Source-capture
plus destination journals block retries even if the bundle is prepared again.
This path is no longer reachable from the attachment or native worker. Its tests
are historical safeguards, not acceptance tests for the requested workflow.

Automated checks currently pass: 67 bridge JS tests, 33 Python AAF tests and eight
native JS transport tests (108 total, with the locally licensed PTSL SDK), plus
six native drag-lifecycle assertions in `Plugin/Tests/LogicDragTest.mm`. The
updated Swift helper compiles and its Developer ID signature verifies; the
frontend and isolated QA AU builds pass. Mock browser UI
capture retains region count/positions and exposes the Logic-specific controls.
These checks do not qualify two-account messaging or real companion automation.

The disable-path regression suite also passes against the installed bundled
worker, including old prepare/drop tickets with no settings or archive supplied.
The frontend and QA AU rebuild pass. Browser QA shows the original track/region
positions and the explicit AAF-export control, but no restore grip or readiness
claim. The worker update is installed; the running DAW has not been restarted or
the production Slur installation replaced. The rebuilt QA AU is not yet reloaded.

For a bundle with verified source layout, the Logic-hosted Orb Chat attachment
offers **Export AAF for Logic Pro**, with a native save dialog. Then use Logic's
**File > Import > AAF** in the open project, not File > Open. This creates fresh
tracks and separate regions. The export button does not claim the project has
been modified. Pro Tools capture/restore controls are hidden inside Logic.
Labels are translated into all eight app languages.

Live qualification in the synthetic `Orb Logic Region QA` project on Logic 12.2:

- October 3: the isolated `Orb Logic QA` AU captured eight tracks/twelve regions
  again, preserving mono/stereo track order and the same exact 48 kHz positions.
  Evidence: `DawBridge/Jobs/d28a9821172d4590b3160436bf684f6c`, capture ID
  `953ccd09-1644-41ea-9de7-18a05ad655d0`. The actual captured attachment reached
  `Ready to drag`. No chat messages/uploads were sent. An earlier capture timed
  out at Go to Folder while UI inspection was interleaved; a retry without UI
  intervention completed. Foreground file-dialog automation remains sensitive
  to concurrent interaction and is not generally qualified.
  The tool-driven drag did not produce an import, so native drag restoration,
  Escape and wrong-target behavior remain unqualified on the live host.
  Pending region gestures now cancel on mouse-up/Escape; late arm requests with
  no held mouse button are rejected, and another press cannot reuse a pending
  gesture. The native regression harness sends no desktop input events.
  Existing Slur 1.0.26 installation was not replaced; it lacks this experimental
  bridge. Only the QA project's insert was replaced for testing. Both normal
  Logic shutdown and restart succeeded in this run.
  To build separately without replacing the installed chat AU:
  `cmake -S Plugin -B Plugin/build-logic-qa -G Xcode -DORB_BUILD_LOGIC_QA=ON -DORB_APP_URL=http://127.0.0.1:5183 -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 -DCMAKE_OSX_ARCHITECTURES=arm64`,
  then `cmake --build Plugin/build-logic-qa --config Release --target OrbLogicQA_AU`.
  The distinct AU identity is `aufx / OrbQ / Orb1`, bundle `com.orb.logic-qa`.
- September 20: the real AU capture button produced an eight-track/twelve-region
  archive. Track order, mono/stereo channels, 48 kHz positions 48137/96137 and
  48274/96274, and 16000-sample lengths were preserved. Job evidence is under
  `DawBridge/Jobs/6dfe47395b26493ba802bb899a6fbfdd`; the companion capture job is
  `743eddca-949d-48cd-88af-ee0d619aa979`. No messages or uploads were sent.
  The fixture's file input subsequently lost WebKit AX visibility. Restarting
  Logic hung in `EuConManagerLegacy::Destroy` / `EuDNSServices::Stop` on the main
  thread. This historical hang was no longer present on October 3; native drag
  restoration and Escape/wrong-target host tests have not been completed.
- September 19: AX inspection and manual AAF export captured six selected regions
  on four mono/stereo tracks, including repeated region names. The empty unnamed
  new-track drop area is now ignored by the capture parser, while populated
  unnamed tracks still fail validation. Expected capture errors no longer expose
  Python tracebacks in the chat UI.
- The resulting Orb archive was converted to AAF and manually imported into the
  same open QA project as four new tracks, with existing tracks still present.
  `logicVerify.py` passed exact AAF readback for all six regions at 48 kHz,
  including positions 48137/96137 and 48274/96274 and lengths 16000.
  Evidence is under `OrbCapture-20260919` and `OrbRestore-20260919` in that local
  QA project directory. No chat messages or remote uploads were used.
- Two new mono/stereo tracks and four regions imported into the existing project.
- Logic's AAF readback matched track names, left/right channels, sample positions
  48137/96137 and 48274/96274, source trims 13/24013, and lengths 16000 at 48 kHz.
- Save/reopen retained all four regions. Existing test tracks remained present.
- A first experiment using shared essence IDs lost repeated occurrences in Logic.
  The converter now embeds independent media per occurrence, preserving PCM.
  The earlier two partial test tracks remain in the synthetic QA project.
- Installed native helper export and AU validation passed; rebuilt Orb Chat AU
  opened in Logic. A local, no-upload AU fixture generated and saved an AAF via
  the real native dialog. The initial UI timed out while the dialog remained open;
  the bridge now waits for the user's save/cancel decision, anchors the dialog to
  the editor and saves through a temporary file. The updated dialog presentation
  still requires live qualification. Two-account transfer requires authenticated
  app testing. This does not qualify arbitrary Logic edits.
- Dragging the AAF row from Logic's All Files browser into the test timeline did
  not import tracks in the tested configuration. Do not label archive/AAF dragging
  as automatic timeline restoration based on file generation alone.

Converter tests cover 16/24-bit mono/stereo PCM, repeated media, hash and metadata
checks, unknown sources, overlaps, source trims, and exact representable positions.
Mixed rates, negative/fractional-sample positions, overlaps, processed regions,
tempo maps, automation, fades, and surround are not supported by this adapter.
Expanded media is limited to 280 MB because each occurrence embeds its source.

```sh
node packages/daw-bridge/install.mjs # SDK optional for Logic; preserves existing SDK setting
node --experimental-strip-types packages/daw-bridge/src/logicCli.mjs bundle.orb-regions.zip new-output-folder
python packages/daw-bridge/test/test_logic_aaf.py
python packages/daw-bridge/test/verifyLogicReadback.py logic-export.json Logic-readback.AAF
```

Python commands require the pinned dependencies in `requirements.txt`; the local
installer supplies them in `~/Library/Application Support/Orb/DawBridge/python`.
`verifyLogicReadback.py` is a read-only, opt-in fixture qualification tool, not a
production importer or a claim that arbitrary AAF files have been validated.

Current local AU uses `http://127.0.0.1:5183` for the development UI. It requires
that Vite server, including after a reboot; no hosted deployment was changed.
The prior AU was backed up outside the scanned Components folder at
`~/Library/Audio/Plug-Ins/Orb Backups/Logic-20260917-1789632697781/`.

Native request regression tests: `pnpm --filter plugin test:native`. Chat file
writes, timeline snapshots and region transfers now share one request ID space
and unsubscribe using JUCE's `[eventId, listenerId]` token. Eight tests cover
out-of-order replies, late replies, cancellation, long-lived save dialogs and
listener cleanup. The bridge suite has 47 tests; Logic and Pro Tools Python AAF
suites have nine and eight tests respectively. All passed locally with the SDK.

For native-only diagnostics, `ORB_REGION_QA=1` on the Vite process redirects `/`
to the local fixture. Debug AU builds record drag pasteboard types and bounded
payloads only on that exact `127.0.0.1/tests/region-bundle.html` page, in a local
temporary `orb-logic-drag-*.json` file. These may contain paths or audio metadata;
they are not uploaded. No actual Logic region payload has yet been qualified.
Restart Vite without this flag before using normal chat, then use Return to app
in the fixture or reopen the editor. Never enable this fixture for a real upload.

## Working Parts

- Orb Chat and the combined plugin send multi-file audio drops as one bundle,
  without mixing or concatenating the audio. Identical assets are stored once;
  every region occurrence remains in the manifest.
- Existing `multi-audio` messages and individual Stems remain readable. Bundle
  assets use the existing R2 attachment-key membership checks. No migration.
- Bundle downloads contain a versioned `orb-regions.json` and hash-named audio.
  Size, referential integrity and SHA-256 checks run before import.
- Downloaded `.orb-regions.zip` bundles can be reattached through Chat/Files
  pickers and drops without losing their source layout, trim or region IDs.
  A new transfer ID prevents separate shares from being combined in Stems.
  Browser and helper use the same bounded archive parser; all hashes are
  checked before any upload. Mixed archive/audio drops are rejected.
- The Pro Tools importer creates new mono/stereo tracks and separate trimmed
  clips. It uses track IDs, never matches an existing track by its name.
- Dry run is the default. Writes require an explicitly inspected session ID.
  A local attempt journal blocks duplicate application and unsafe automatic
  retries. Partial failures are recorded, not hidden with a global Undo.
- Import success now requires reading back the created clip source/trim and
  the actual timeline's per-channel positions/durations on the new tracks.
  Recording/playback stops the import. Unqualified overlapping layouts are
  refused before mutation rather than risking edits to underlying regions.

## Not Yet Implemented

- Native DAW drag payloads currently contain file bytes, not verified source
  track IDs or current timeline clip instances. Ordinary drops therefore use
  `source: null`, no tracks, and `start: null`. BWF/filename/playhead guesses
  are deliberately not used. Automatic placement refuses these bundles.
- Connecting verified source-selection capture to automatic native drag events.
  A live test confirmed that Pro Tools AAF export includes unselected regions
  on the selected track. It is not an exact selected-region capture adapter.
  A Copy-to-temporary-tracks prototype now produces complete manifests and
  passes a live mono/stereo capture/import round trip, described below. It is
  deliberately not wired to native drags yet: discontiguous object selections,
  arbitrary object-selection qualification, clipboard restoration and real drop-source
  identity still need qualification. An outer-range filter is not sufficient.
- Host qualification of the Logic native drag-out gesture. Pro Tools still uses
  the restore button and has no automatic drag-out importer.
- Redistributable installation without a user's separately licensed SDK.
- Logic incoming-drag interception/host qualification, Cubase, Ableton Live and
  other DAW adapters.
- Tempo-map transfer, elastic audio, fades, clip gain, automation, overlapping
  region layering and surround.

## Developer Commands

### Local native installation

```sh
ORB_PTSL_SDK=/path/to/licensed/PTSL_SDK node packages/daw-bridge/install.mjs
```

This links the installed Node runtime and installs a bundled helper and pinned Python AAF reader
under `~/Library/Application Support/Orb/DawBridge`. It references the SDK at
its original path; it does not copy or redistribute it. Rebuild the native
Orb/Orb Chat application and serve the updated UI to expose its controls.

The capture control next to Chat/Files attachments captures the current stopped
Pro Tools selection, validates the archive, then uses the existing bundle upload
path. It temporarily creates tracks and replaces the Pro Tools edit clipboard.
Selected mono/stereo source tracks (including nonadjacent tracks) and supported unprocessed WAV regions
are accepted. Closing the conversation does not send into a different one.

The restore control on a complete bundle inspects the current session before
download, creates fresh tracks there, and requires actual timeline readback.
Capture/import share an exclusive process lock. Journals and validated media
remain under `~/Library/Application Support/Orb/RegionTransfers`; native jobs
remain under `DawBridge/Jobs`. Interrupted operations are not retried blindly.
The native transport has a 300 MB archive limit and a four-minute deadline.

For local UI testing against the existing API deployment, start Vite with the
root environment loaded and `ORB_DEV_API_URL` set to that deployment. This
proxy is opt-in and does not change production routing. A local development
app is not a deployment or proof of two-account transfer.

From the repository root, set the SDK directory:

```sh
export ORB_PTSL_SDK=/path/to/PTSL_SDK_CPP.2026.04.0.1301892
pnpm --filter @orb/daw-bridge inspect:pro-tools
pnpm --filter @orb/daw-bridge test
```

Inspect is read-only and does not launch or replace a Pro Tools session.
Current-session registration and reading were verified locally with SDK
2026.04. Real import and save/reopen tests have now been performed in the
user-approved `new test` session; see the qualification record below.

For a bundle that already has a complete, verified source layout:

```sh
node --experimental-strip-types packages/daw-bridge/src/cli.mjs import /path/bundle.orb-regions.zip
```

To apply a reviewed plan in a disposable test session, append
`--apply <session-instance-id>` using the ID from `inspect`. This adds media,
tracks and clips to the current session. It does not create a new project.
Use a saved test copy, not an unsaved production session, until real-host
qualification is complete. State is checked before each operation, but PTSL
calls are not an atomic project transaction; concurrent user edits remain a risk.

Imported audio is copied into the session. The validated download cache and
attempt journal stay under `~/.cache/orb/region-bundles`. An incomplete journal
requires inspection of the session before any manual retry; no auto-rollback.

## Verification

`pnpm --filter plugin build` verifies the application. Run the plugin dev
server and open `/tests/region-bundle.html` for an isolated UI fixture. It
uses synthetic audio and never sends messages or uploads user audio.
Checked at 320 px and 1100 px widths, light/dark themes, English/Korean,
expand/collapse and ZIP download. Other strings cover all eight app languages.

All 39 automated tests passed locally with `ORB_PTSL_SDK` set (otherwise the
licensed-schema test is skipped). The full authenticated UI was also bundled
using dummy compile-only Supabase settings, since the local environment is
unconfigured; those settings are not a working backend. Real two-account
upload/reload tests and plugin-host drag gestures have not been performed.

Browser download/re-attachment round trip was checked using synthetic audio:
one source track, two region instances, positions 0 and 0.2 seconds remain
visible after reattachment. The read-only EDL parser was tested against the
current Pro Tools session (48 kHz, 23 audio tracks, zero timeline events).

## Live Pro Tools Qualification (2026-09-15)

The user explicitly designated `new test` as a test project. Synthetic
mono/stereo PCM16 files at 48, 44.1 and 96 kHz were imported into its 48 kHz
session. Each run created two fresh tracks and four independently trimmed
regions at non-grid sample positions. All three runs passed source-file ID,
source-offset/end, channel mapping, timeline position and duration readback.
Existing track identities and timeline events were unchanged.

Real-host differences found and fixed:

- `CreateAudioClips` requires numeric JSON `MediaTimePosition.position`;
  protobuf-style int64 strings fail with `PT_InvalidParameter`.
- `GetClipList` returns `clip_list` on this host, despite `clips` in the
  downloaded proto. Both response fields are accepted.
- `CopyAudio` rejects different sample rates; use `ConvertAudio` explicitly
  and verify the resampled length and source trims.

Save/reopen passed with all six source-cache WAV files temporarily renamed
out of reach: all 12 regions / 18 channel clips stayed online, on the same
tracks and positions, referencing six files inside the session's Audio Files.
The original cache filenames were restored afterwards. Six successful QA
tracks remain in the saved test session; two empty failed-test tracks were
removed by their recorded IDs, after confirming they still contained no clips.
No existing track was deleted. Playback/listening was not tested.

Reproducible, opt-in scripts (never run by the unit-test glob):

```sh
node --experimental-strip-types packages/daw-bridge/test/liveProTools.mjs 'new test' '<inspected-id>' 48000
node --experimental-strip-types packages/daw-bridge/test/liveProToolsReopen.mjs <completed-test-directories...>
```

Artifacts live under `~/.cache/orb/live-tests/`: per-run manifest, complete RPC
trace, receipt and baseline. Successful runs: `1789425519710-a85d59c1` (48 kHz),
`1789425545188-a534dc69` (44.1 kHz), `1789425690998-6936ef37` (96 kHz).
The first run folder also contains `reopen.json`.

Sender-side probe: the mono QA track had regions at samples 48137 and 96137,
each 16000 samples long. With edit selection [48137, 64137),
`ExportSelectedTracksAsAAFOMF` exported **both regions**. The AAF composition
was inspected using pyaaf2 1.7.1 in a separate test venv, not shipped with Orb.
`test/liveProToolsAAF.mjs` and `test/inspectAAFSelection.py` reproduce this
probe. No source audio was uploaded. AAF artifacts remain in the user's
`Music/Orb QA Exports/a85d59c1` folder.

This qualifies the development importer for these tested layouts only. It
does not qualify native drag capture/drop completion, arbitrary clip effects,
overlaps, other DAWs or end-to-end chat transfer. No native plugin was rebuilt,
installed or restarted in this qualification run.

## Native integration checks (2026-09-17)

45 JavaScript tests (including licensed schema validation) and eight Python
AAF tests pass. Authenticated frontend and Orb Chat standalone compile. The
local helper installs successfully. New capture tests cover actual-selection
Copy ordering, combined track-selection states, recording/session guards,
nonadjacent-track rejection, export failure and failed temporary-track cleanup.
These are automated host doubles, not additional real-host qualification.
Pro Tools was not accepting PTSL connections when these checks started; the
two-account server transfer still needs live testing.
Logic Pro, Cubase and Ableton adapters remain unimplemented. This is not a
claim that the full multi-DAW drag workflow is complete.

After opening the designated `new test` session, the installed native helper
passed `test/liveNativeRegionBridge.mjs`: two adjacent synthetic mono/stereo
tracks, four regions, exact original starts/source trims, mandatory import
readback, existing timeline preservation and duplicate-attempt refusal.
Capture temporary tracks were removed and the prior selection was restored.
Two new QA import tracks remain; no automatic session save was performed.
Artifacts: `~/.cache/orb/native-tests/04e478ad-1a0e-4a4a-aaf9-41d1027ebf2c/`.
The browser fixture with `?native=1` separately checks the JUCE message protocol,
capture-to-attachment UI and verified restore state using doubles, not a DAW.
The rebuilt debug Orb Chat is served by a local development server; the
installed production app and hosted frontend have not been overwritten.

### Nonadjacent track capture fix

The prior adjacent-track restriction is removed. Source tracks are sorted
explicitly and original indices retained in the archive. A live probe showed
Pro Tools maps copied nonadjacent sources onto selected destination tracks in
sequence, without spacer tracks.

In `new test`, `liveNativeRegionBridge.mjs --gap` inserted one synthetic gap
between the mono/stereo QA sources, selected only the sources, captured and
restored all four regions with exact offsets and positions, verified existing
timeline preservation and blocked duplicate import. Temporary capture tracks
and the gap were removed; successful QA import tracks remain.
Artifacts: `~/.cache/orb/native-tests/aca06667-7194-40a8-b035-d884be0e02a2/`.
The preceding failed probe left two recorded partial QA import tracks; they
were not hidden by a global Undo. Its import journal remains for inspection.

The test also exposed a host pagination discrepancy: `GetClipList` reports
the current page count as `pagination_response.total`. The importer no longer
mistakes the first 100 clips for the entire list. Track and media pagination
also use page exhaustion rather than that inconsistent total field.

## Sender Capture Qualification

The opt-in `test/liveProToolsCopySelection.mjs` script copies only synthetic
QA selections into newly created temporary tracks, exports their linked AAF,
records a selected-media allowlist from PTSL, then removes its temporary
tracks by recorded identity. It verifies the existing timeline is unchanged.
It changes the Pro Tools edit clipboard; it is not a production drag handler.

`src/proToolsAAF.py` uses pyaaf2 (pinned in `requirements.txt`) to resolve those
AAF regions. It cross-checks every channel's position and duration against the
captured EDL, restores original source track identities/names, and accepts
only original interleaved mono/stereo 16/24-bit PCM WAV files on the PTSL
selected-media allowlist. It does not infer positions from BWF timestamps or
filenames. Unsupported effects, non-unity gain/fades, split-mono sources,
ambiguous channel mappings and incomplete media lists fail closed.

An important real-host finding: `CopyFromSourceMedia` AAF export altered PCM
sample values even with the source bit depth selected. The qualified path
uses `LinkFromSourceMedia` instead and puts the original, host-identified WAV
bytes in the bundle. Pro Tools adds BWF metadata on initial import, so WAV
container hashes differ from the original fixture, but its PCM samples match
exactly. No audio is re-encoded by the capture converter.

Live results in `new test`:

- Single-region selection: only the selected region was copied/exported; the
  other region on the same track was not included.
- Mixed mono/stereo selection: two source tracks, four regions, six channel
  instances preserved through capture, archive validation and real reimport.
- Starts 48137/96137 (mono), 48274/96274 (stereo), offsets 13/24013 and lengths
  16000 samples all matched the original 48 kHz fixture. Source PCM was exact.
- Original 35 tracks and their current timeline remained unchanged. Two new
  round-trip QA tracks remain (`Orb QA a85d59c1 Mono 1` and `... Stereo 1`).
  This later test was not saved/reopened; no automatic save of user edits.
- The real captured archive was reattached and downloaded through the browser
  fixture, preserving all track/region identities, offsets and positions.
  This uses an in-memory upload substitute, not a two-account network transfer.

Successful artifacts: `~/Music/Orb QA Exports/copy-selection-linked-01/`,
including `Selection.orb-regions.zip` and `round-trip/receipt.json`.
Earlier `copy-selection-multi-*` exports are rejected experiments, not the
qualified transfer path. Eight Python tests also pass:

```sh
python -m pip install -r packages/daw-bridge/requirements.txt
python packages/daw-bridge/test/test_pro_tools_aaf.py
```

Native Pro Tools screen inspection failed in the computer-use service during
this run; PTSL remained available. Actual plugin drag gestures, clipboard
restoration, production helper packaging and other DAWs are still unverified
or unimplemented. These results do not mean the requested whole app workflow
is complete, and no plugin installation/restart was performed.

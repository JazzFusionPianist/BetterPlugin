# DAWproject region receiver adapter

2026-09-26. Partial destination implementation, not universal region sharing.

## Contract and flow

    validated Slur bundle + downloaded original WAVs
                      ↓ hash/header/layout checks
        audio-only DAWproject (seconds, no transport map)
                      ↓ prepare local file, explicit user drag
        host importer (behavior depends on DAW/version)

`createRegionDawproject` requires known song-relative starts, track membership,
source offsets, lengths and complete audio metadata. An ordinary file drop
without edited positions cannot enable this operation. BWF/iXML clocks do not
satisfy the contract. Files are bounded by the existing 500 MB bundle limit.

Supported media subset: mono/stereo RIFF WAV, PCM 16/24/32-bit or IEEE float
32/64-bit. Headers and frames must agree with the manifest, hashes must match,
and track/asset channels must match. No decoding, resampling, silence padding,
instrument rendering, inferred position or invented tempo is performed.
Negative/unrepresentable starts, missing media and invalid XML names fail before
any native drag is armed. There is no partial-success project file.

The adapter uses generated XML IDs, escaped names, hash-based internal paths,
explicit track lanes and nested audio-event clips. Original media bytes are
unchanged and repeated occurrences share one packaged asset. The native bridge
caches a unique `.dawproject` in the OS temp folder, returning an opaque UUID.
Only that UUID can be used to arm the existing native file drag. No caller path
is accepted, no ZIP is extracted by the plug-in and no DAW window is automated.
Web-only clients download the file instead. A drop acceptance is NOT reported as
verified placement in the destination project.

## Live qualification

Synthetic fixture: two tracks (48 kHz mono / 44.1 kHz stereo), three regions,
two uses of one source asset; starts 2.5 s, 8 s + 1/48000 s, 1.5 s; source trims
0.5/0.5/0.25 s; durations 0.75/0.75/1 s. No user music or chat uploads used.

- Official Project.xsd and MetaData.xsd validation passed against Bitwig
  dawproject commit `ee4dcdde75940f30e14e55401a26955a58b8322b`.
- Fender Studio Pro 8.0.3.111164: initial seconds-based layout opened as a new
  session. Re-exported DAWproject retained all three starts at 48 kHz resolution,
  trims and both original media SHA-256 hashes. Final nested structure was also
  reopened successfully with the expected two tracks and three regions visible;
  numeric readback/hash assertions used the initial export round trip.
- Cubase Pro 15.0.21: initial direct-Clip lane form lost events despite passing
  the schema. The final explicit lane / nested event form imported successfully.
  Re-export of the final two imported tracks preserved all three sample starts,
  offsets, durations and media SHA-256 hashes. Cubase reused the last event name
  for two occurrences of one source file; distinct per-occurrence names are not
  qualified. Its import command asks whether to create a new project; choosing
  No successfully added tracks to the existing *synthetic* test project.
- Bitwig: official format support, NOT live-tested here.
- Logic, REAPER, Live, FL Studio, LUNA, Mixbus, Nuendo: NOT qualified by this
  adapter. Do not present the DAWproject button as universal support.

QA files were generated under `/tmp/slur-dawproject.8q77yJ/`. Reproduction fixture
is `test/dawprojectFixture.mjs`, not a dependency on those temporary files.
The live tests invoked host import/export menus as developer QA only. They are
not production automation or the final drag-only UX.

## Remaining gates and trade-offs

The sender still needs verified current edited positions from native DAW drag
payloads; file URLs alone do not supply them. Tempo/meter maps, fades, gain,
stretch/reverse and effect processing are not represented by bundle v1 and
cannot be claimed as preserved. This adapter preserves the audio/trim semantics
explicitly present in v1, not arbitrary DAW sound.

Open/import of a project file is not the same as insertion into a current
session by a single gesture. Native Slur-button drag, current-session drag in
each target, non-zero project origins, tempo changes, overlaps, larger media,
other PCM formats and two-account delivery remain live qualification gates.
No automatic host detection claims these targets as fully supported.

Revisit the adapter boundary with AAF/host-native importers for other DAWs,
bundle v2 for tempo/edit semantics, per-occurrence media paths if Cubase clip
names must survive, and streaming ZIP/download/native IO for larger bundles.

## Local delivery

Implementation commit `893b535`; embedded frontend uses the same build ID.
Slur 1.0.18 universal AU/VST3/Standalone replaced the local installed copies,
Developer ID signed and strictly verified. AU validation passed; Standalone
loaded `juce://juce.backend/index.html?plugin=1&surface=chat&ver=1.0.18&carried=1`.
38 tests passed, 8 unrelated visual-worker tests skipped; frontend/native builds
passed. The older installed AAX was left untouched (PACE license blocker from
the preceding installation). No remote push or Vercel deployment was performed.
Previous installed bundles are retained in
`~/Library/Application Support/Slur/Backups/dawproject-20260926.X6ybHw`.

## Sources

- https://github.com/bitwig/dawproject (schema and Clip/Audio definitions)
- https://www.bitwig.com/de/support/technical_support/dawproject-file-format-faqs-62/
- https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/exchanging_files_with_other_applications/exchanging_files_with_other_applications_importing_dawproject_files_t.html
- https://support.presonus.com/hc/en-us/articles/19743606863629-Introducing-DAW-Project

# Native region drag qualification

2026-09-27. This is a qualification boundary, not universal DAW support.

## Required flow

Source DAW selection → structured drag evidence → validated/cropped audio and
region bundle → chat → destination-specific native import → verified placement.

The host-independent middle is implemented. Each end has a separate contract:
capture must supply current edited start, source trim and track membership;
restore must consume those values in the current project. Plain file URLs,
recording timestamps and the playhead do not satisfy either contract.

Pro Tools track export remains separate and unchanged. No production host
export-dialog automation or realtime playback fallback is enabled.

## Current evidence

| Path | Implemented | Actually verified |
| --- | --- | --- |
| File-only drag | Audio transfer, unknown layout retained | Not proof of edited positions |
| VST-XML capture | Bounded parser, selected PCM crop, seconds positions and groups | Parser/core tests; native source-host capture still unqualified |
| VST-XML restore | Persistent audio cache and native text drag | Native drag-start event observed; DAW acceptance/placement unqualified |
| DAWproject restore | Audio-only project package | Cubase 15 and Fender Studio Pro 8 file import/readback; not one-drop current-session UX |
| Logic/LUNA/Live/REAPER/FL/Mixbus native exact restoration | No qualified importer | Not supported by the VST-XML implementation merely because the plug-in loads |

See `DAWPROJECT-REGIONS.md` for numeric readback results. Spec compatibility is
not a substitute for host/version-specific testing. Nuendo/Live/Bitwig/FL/REAPER
are not installed on this development Mac and have not been live-tested here.

## Native drag correction

Use delivered event coordinates in the source window, instead of separately
sampling the global pointer during every event. Ignore events in other windows.
Once a native drag starts, consume that event and reject late asynchronous
re-arm requests so WebKit cannot reset the live drag state/payload. Mouse-up
alone must not mark a native drag complete; AppKit's completion callback owns
that transition. `DragLifecycleTest.mm` tests delayed-arm and completion state.

The developer-only harness is built with:

```
node --experimental-strip-types packages/track-export/test/buildDragHarness.mjs
```

It creates a temporary app and synthetic two-track/three-region fixture, using
the production DragMonitor. Open the reported app via normal UI tooling. No
authentication, chat upload, DAW control or network traffic is implemented in
the harness. Use synthetic audio only. QA builds alone record drop types/text
and resolved test audio under the OS temporary directory; shipped builds do not.

On this Mac, injected app-scoped drag input produced `__juceOutDragStart`, but
no new Cubase regions were observed. After Escape, the harness eventually
reported `__juceOutDragEnd` with `op: none`. This cancellation does not qualify
native cross-application restoration, nor establish that the host rejects the
protocol: the test did not demonstrate delivery to its native drop target.

## Trade-offs and remaining blockers

Fail closed on unsupported structured data instead of silently flattening it
into unrelated whole-source files. Retain received media because some hosts
reference it rather than copy it. Keep incomplete positions explicitly unknown.

There is no implemented evidence source for edited positions when the DAW only
offers a file, nor a qualified universal import primitive. More serialization
code cannot supply missing source data or force a host to consume positions.
An additional host-supported capture/import channel is required for those
hosts. AAF/project-file conversion may be useful but must not be represented as
the requested single-drop current-project workflow.

Revisit the boundary with an actual host API/payload and a native capture →
restore round-trip fixture. Tempo/meter maps and gain/fade/stretch semantics
also require a versioned schema and source evidence; a BPM snapshot is not a
tempo map. Until those gates pass, the overall request remains incomplete.

Primary protocol reference:
https://steinbergmedia.github.io/vst3_dev_portal/pages/Technical+Documentation/Clipboard+VST-XML/Index.html

## Local delivery

Code commit `6f7ead0`, Slur 1.0.20. Universal arm64/x86_64 AU, VST3 and
Standalone built, Developer ID signed, strictly verified and installed locally.
AU validation passed. Tests: 45 passed, 8 unrelated visual tests skipped, none
failed. Frontend embeds build `6f7ead0`. No remote push/deployment was performed.
The working installed AAX was preserved (previous PACE signing-license blocker).
Previous AU/VST3/Standalone bundles are recoverable at
`~/Library/Application Support/Slur/Backups/region-drag-120-psAHHWFn`.

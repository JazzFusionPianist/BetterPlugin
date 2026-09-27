# Cubase / Fender Studio Pro qualification

Updated: 2026-09-25. Status: **visual qualification experiment superseded by the
background-only requirement; end-to-end adapters not qualified or shipped**.

The subsequent public native SDK audit and render contract are recorded in
[BACKGROUND-EXPORT.md](./BACKGROUND-EXPORT.md). Its background-only decision
supersedes the historical visual proposal and visual revisit criteria below.

## Latest user constraint (supersedes the visual integration proposal below)

No native DAW export window may appear. The user selects tracks and sends them
entirely inside Slur, as with the existing Pro Tools experience. Do not steal
focus, simulate clicks in a DAW dialog, move a dialog offscreen, or substitute a
manual export/watched-folder workflow. Background offline render and automatic
attachment are required, not simply hidden UI automation.

The experimental export dialog was closed without rendering. Stop productizing
the visual probe: it proved that text/checkmarks could be observed, NOT that a
headless export API exists. Preserve the experimental source as development
evidence; do not add it to advertised native capabilities or invoke it from Slur.
The next release gate is a native per-host track enumeration and background
render mechanism. The inspected Cubase MIDI Remote and Fender control-surface
interfaces have not yet established a complete headless rendering contract.

## Required outcome

Inside Slur, enumerate the current project's tracks, select several, render each
offline over one common session/selection range, validate the outputs, and pass
the archive to the existing attachment flow. Do not create bounced project
tracks, substitute source clips for processed stems, or require real-time play.

## Local observations

| Installed host | Native export | Observed Accessibility information | Qualification |
| --- | --- | --- | --- |
| Cubase Pro 15 (`com.steinberg.cubase15`) | File → Export → Audio Mixdown; Single / Multiple channel selection | Export window title and filename text field, but no channel list, range controls or export controls | Dialog opened only; no automated render or attachment verified |
| Fender Studio Pro 8.0.3 build 111164 (`com.fender.studioapp`) | Session → Export Stems; Tracks / Channels, Session Content and marker/loop ranges | Dialog title and window buttons, but no source checkbox list, range or format controls | One synthetic WAV imported into a new QA session and export dialog opened; no render or attachment verified |

The installed Fender keyboard map did not match the documented default export
shortcut: Cmd-Shift-E opened Insert Silence. That dialog was cancelled without
applying it. Use semantic menu commands, never assume default shortcuts.

Both export dialogs were closed without starting a render. No user project was
opened, no chat file was sent, and installed Slur binaries were not replaced.
Synthetic test sessions/fixtures remain available for the next qualification run.

Installed Fender Control Surface SDK sources expose mixer banks/channel types
and command dispatch. The inspected SDK/device examples did not establish an
API contract for export selection, destination, range and completion. This is
not proof that no private/vendor API exists. Cubase's MIDI Remote integration
must likewise not be treated as an offline render API without such a contract.

## Proposed integration boundary

    Slur picker → private job + host lock → per-host adapter
                                               ↓
                              verified native track/format/range selection
                                               ↓
                                        host offline renderer
                                               ↓
                          output identity / WAV / common-length verification
                                               ↓
                                   existing archive and uploader

Prefer a documented native API whenever it covers the full operation. An
alternative local-only visual adapter was authorized by the user on 2026-09-25.
The user explicitly rejected a manual-export fallback: track discovery,
multi-selection, render and attachment must remain initiated inside Slur.
Do not replace this requirement with a watched-folder/manual export workflow.
OS privacy permission remains separately controlled by the user.

Visual integration must be restricted to the verified DAW PID and
window, process images locally, and avoid network image transmission. It still
needs verified checkbox state, stable identity including duplicate names,
scrolling/virtualization coverage, positive range validation, completion signals,
and safe cancellation. OCR labels alone are not enough to guarantee correctness.

## Release gates

- Two distinct synthetic tracks, one with leading silence, plus a duplicate-name
  case; confirm selected IDs match generated audio (not just filenames).
- Prove equal positive frame counts and sample rates, required bit depth, effects
  inclusion, range start metadata, and no accidental master-only render.
- Reject stale project snapshots and changed track selections before rendering.
- Unique private output directories; no overwrite; no automatic publishing.
- No surprise project content edits; preserve selection or report uncertainty.
- Timeout or unexpected modal stops the job; uncertain cleanup retains the host
  lock/journal rather than blindly retrying.
- Installed plugin → picker → actual host render → attachment integration test
  before adding the host to advertised native capabilities.

Nuendo, Live, Bitwig, FL Studio and REAPER are not qualified by these observations.
Even hosts sharing an export concept require their own version/layout/API tests.

## Vendor references

- [Cubase 15 Audio Mixdown](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/export_audio_mixdown/export_audio_mixdown_to_audio_files_mixing_down_t.html)
- [Cubase 15 DAWproject interchange](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/exchanging_files_with_other_applications/exchanging_files_with_other_applications_dawproject_files_c.html): metadata/state interchange is not a rendered-stem export substitute.
- [Fender Export Stems](https://fenderstudiopromanual.fender.com/en/Content/Saving%2C%20Import%20and%20Export/Export_Stems_from_your_Session.htm): online documentation can be newer than installed 8.0.3; validate controls on the installed host.

## Read-only visual qualification worker

`install-visual.mjs` builds/signs a universal `Slur Visual Bridge.app` without
replacing plugins or the existing Logic helper. `inspect-visual.mjs fender8` or
`cubase15` reads an already-open native export dialog into a private job. Only
the exact allowlisted host and dialog can be captured, through a single-window
ScreenCaptureKit filter. Apple Vision reads text locally without spelling
correction; no images are persisted or sent to a service. Window identity and
geometry are checked again after recognition. This worker does not click,
render or upload, and reports `exportReady: false` explicitly. It is a foundation
for the adapter, not evidence that track selection/export works yet.

### Actual 2026-09-25 qualification results

- Universal arm64/x86_64 helper built, Developer ID signed, and installed.
  Existing plugin formats and Logic bridge were not replaced.
- On the new `Slur Visual Export QA 20260925` session, imported synthetic
  `Slur QA A.wav` and `Slur QA B.wav`. The local worker recognized both source
  names and `Main` in Fender's export dialog.
- A narrow 1014 × 588 point dark-theme profile sampled checkbox pixels
  separately from OCR text. Both tracks initially checked; toggling A through
  the QA UI was read as A unchecked / B checked, then restoration was read as
  A checked / B checked. Main remained unchecked. No render was triggered.
- OCR alone incorrectly suggested a bullet beside the unselected Tracks radio
  label. Consequently, text confidence must NOT be used as radio/checkbox state
  evidence. Pixel observations are still provisional, not production-qualified.
- Eight installed-helper rejection tests passed: arbitrary path, expiry,
  unbounded expiry, wrong host, unsupported operation, non-private directory,
  existing response, and symlink job path. No screen capture in these tests.
- Missing export dialog returns an explicit failure with `exportReady: false`.
- Complete list coverage, truncated/duplicate names, radio and option state,
  automatic dialog control, actual render, and Slur attachment remain pending.
  Cubase's visual profile has not yet passed a live recognition test.

Revisit the implementation once recognition, checkbox state, complete list
coverage and actual render identity can pass the release gates above, or a
vendor-supported complete export API becomes available.

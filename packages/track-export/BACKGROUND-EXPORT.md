# Background-only host integration: decision and remaining contract

Date: 2026-09-25. Status: blocked on a verified host rendering interface for
Cubase 15 and Fender Studio Pro 8.0.3. Not a completed or installed feature.

## Logic follow-up: identical user experience requirement

The same no-dialog requirement also applies to Logic. Its existing
`LogicTrackBridge.swift` is Accessibility UI automation: it foregrounds Logic,
selects each track, opens File → Export → Tracks as Audio Files, configures the
dialog, and presses Export. It is not a headless API and is not equivalent to
the Pro Tools PTSL implementation. The helper runs outside the plug-in, but that
does not mean the DAW work is invisible to the user.

On 2026-09-25 the installed Logic Pro 12.2 scripting dictionary was inspected
using macOS `sdef`. It exposes generic Standard/Text/type suites, not a track
enumeration or audio-export command. `NSAppleScriptEnabled` is true, but that
flag does not imply an audio-specific scripting API. The application contains
no `.sdef`, `.scriptSuite` or `.scriptTerminology` files in the inspected bundle.
The generated dictionary, rather than missing files alone, is the relevant
negative result. Public Audio Unit documentation did not establish a mechanism
for a plug-in to request the host's full-session stem rendering either.

No implementation or installation change was made in this follow-up: removing
the existing export feature, covering its dialog, or using realtime capture
would not satisfy the request. A verified Logic render contract is still needed
before the existing adapter can honestly be replaced with a no-dialog path.
Do not infer that such an unpublished contract exists. Revisit upon concrete
API evidence or an explicit change to the no-dialog requirement.

## Required experience

Select multiple project tracks inside Slur and send processed, equal-length
stems to the chosen conversation. No DAW export dialog, focus takeover,
offscreen dialog, UI scripting, manual export, new bounced tracks or real-time
capture. Preserve the existing Pro Tools export path and collaborator UI work.

## Public interface audit

| Interface examined | Established capability | Missing requirement |
| --- | --- | --- |
| Cubase MIDI Remote | Mixer-bank channel labels/selection and command bindings | Documented render job accepting track IDs, range, destination, format and completion without GUI |
| Fender/PreSonus `IContextInfoProvider` | Instance channel metadata; document identity/name/folders | Complete project enumeration and render scheduling |
| Fender/PreSonus `IHostCommandHandler` | Parameter-specific context-menu commands | General background stem-render API |
| Fender Mix Engine FX developer description | Access to source-channel signals at a summing bus | Arbitrary timeline evaluation and offline render scheduling |
| Steinberg GAC 2.1.1 build 34 (2026-02-19), entire `gac_sdk.h` | Nuendo asset metadata, exported-file notifications, project-opening requests | Full project track enumeration and client-initiated stem-render request; Cubase support not established |

Fender public headers were inspected at commit
`8f6344ca453f3ac69228ded9dd6f63c4941a7239` of the official extensions repository.
`ipslviewrendering.h` concerns GUI bitmap rendering, not audio rendering.
GAC's background callback execution is event delivery, not background audio
rendering. Its drop-path setter does not trigger export. Do not conflate these.

These findings describe the inspected public interfaces; they do not prove that
private partner interfaces cannot exist. No private protocol should be guessed
from an SDK name or command label. No vendor agreement has been accepted, SDK
linked into Slur, or SDK redistributed as part of this investigation.

## Immediate source correction

The legacy Cubase MIDI adapter bound `Perform Audio Export`, changed selection,
and sent the command without controlling range, destination or completion.
`OrbControlBridge` advertised that as native export and returned success based
only on a MIDI source port existing.

- Remove that command binding and reject legacy export packets without changes.
- Reject export in C++ too, protecting against older installed remote scripts.
- Report `exportMode: none` and `backgroundOfflineExport: false`.
- Retain metadata and explicit selection operations; leave PTSL untouched.
- Five mock-host JavaScript regression tests pass. This is not a native build
  or installed-DAW end-to-end test; installed binaries are unchanged.

## Intended architecture after a host contract is obtained

    Slur picker → snapshot + stable track IDs → host job adapter
                                                  ↓
                                 background native offline renderer
                                                  ↓
                             completion receipt → WAV/identity validation
                                                  ↓
                                      existing chat attachment flow

Track-list capability and render capability must be independent. A connected
MIDI port, received channel label, or accepted command does not enable Share.
Do not advertise a 64-channel visibility-following bank (or eight MCU strips
with truncated labels) as the complete project.

The host contract must provide:

1. Project identity/revision and stable track IDs, including duplicate names,
   folders, hidden tracks, instrument tracks, buses and automation semantics.
2. A common start/end in samples, with explicit session/selection semantics.
3. Render request: selected IDs, destination, WAV/sample rate/bit depth, effect
   inclusion, tails, routing/sidechains, pre/post-fader policy and overwrite policy.
4. Accepted job ID, progress, cancellation and authoritative completion/error.
   Command acceptance is not completion.
5. A receipt mapping each ID to output path, frames, rate, depth and start offset.
6. Guaranteed no export window, project-content changes or foreground takeover.

Use private job directories and per-host locks. Reject stale snapshots and
unauthorized paths; validate positive matching frame counts and requested
outputs before upload. Uncertain cancellation/restoration retains the lock and
reports the error instead of retrying and risking duplicate exports/messages.

## Vendor engineering questions (prepared, not sent)

Slur Studio is developing a collaboration plugin that exports selected tracks
from the currently open project to private WAV files, then attaches them to a
conversation. Does your current macOS host offer a supported public or partner
interface satisfying the contract above, without opening an export dialog?

- Steinberg: Does Cubase 15 expose this outside MIDI Remote, or is there a
  partner render-job API? If Nuendo differs, which editions/versions support it?
  The inspected GAC C API supplies exported assets but no client render request.
- Fender: Is there a partner API for complete track enumeration and offline
  stem rendering beyond the public context/parameter-command extensions and
  Control Surface command dispatch? Is Mix Engine FX relevant to scheduling,
  not merely observing audio supplied by the host?
- Both: Please provide versioned SDK documentation, sample code, licensing
  terms, macOS distribution/entitlement requirements and completion guarantees.

No vendor inquiry was sent. Vendor coordination/access is the next dependency,
not another implementation of export-window automation. Revisit after obtaining
the missing contract and verify on synthetic two-track and duplicate-name
sessions before enabling the capability or replacing the installed plugin.

## Sources

- [Steinberg MIDI Remote API](https://steinbergmedia.github.io/midiremote_api_doc/codedoc_api_reference/)
- [Steinberg proprietary SDKs](https://www.steinberg.net/developers/prorietary-sdk/)
- [Official GAC SDK download](https://www.steinberg.net/gacsdk)
- [Fender/PreSonus developer overview](https://www.presonus.software/developer)
- [Official plug-in extension headers](https://github.com/fenderdigital/presonus-plugin-extensions)
- [PreSonus Software contact page](https://www.presonus.software/company/contact-us)

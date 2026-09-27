# DAW track export adapters

The product workflow is one Slur track picker → multiple selected tracks → host
offline render → validated audio archive → existing conversation upload. Host
adapters are not additional audio inserts. This does **not** require StemLink on
every channel, nor create bounced tracks in the user's project.

## Qualified scope (2026-09-24)

| Host | Connection | Current range | Verification |
| --- | --- | --- | --- |
| Pro Tools | PTSL | Audio timeline / explicit selection | Existing native adapter, 7 regression tests |
| LUNA | Local host render service | Entire session | Existing native adapter, 8 regression tests |
| Logic Pro 12.2, macOS, English UI | Signed Accessibility helper | Project start at bar 1 → project end | Real 9-track QA project; two selected tracks each produced 12,288,000 stereo frames at 48 kHz / 24-bit; selection restored |
| REAPER | Native/ReaScript adapter needed | Not enabled | Not installed/tested on this machine |
| Cubase / Nuendo, Studio Pro, Mixbus | Host-specific adapter needed | Not enabled | No qualified track-render adapter in this package |
| Live, Bitwig, FL Studio | Host-specific adapter needed | Not enabled | Not installed/tested on this machine |

An unsupported host now retains the track-picker entry and explains that its
adapter is not connected. It never silently falls back to Pro Tools or claims a
generic MIDI control surface can perform a completed offline render.

## Boundaries

    Slur UI → native job bridge → per-host adapter → DAW renderer
                                     ↓
                             WAV / identity validation
                                     ↓
                         region archive → existing uploader

The native bridge only accepts named operations. The Node worker serializes
mutating operations with per-host lock files and writes private local journals.
The Logic helper is a signed universal macOS app (not a plug-in). It operates only
Logic, uses semantic Accessibility controls, and uses keyboard events only for
the verified file destination dialog. No screenshots, OCR, clipboard transfer,
network listener, or global arbitrary automation endpoint are used.

## Logic details and limits

- Install `install.mjs` and `install-logic.mjs`; the latter requires
  `SLUR_CODESIGN_IDENTITY`. macOS Accessibility permission is user-controlled.
- Read the saved project identity and Tracks-area headers. IDs are explicitly
  snapshot-bound hashes, not persistent Logic UUIDs. Reorder/rename/region-bound/
  visible tempo/start/end changes invalidate the selection before each render.
- Track stacks must be expanded to expose their child headers. Hidden tracks and
  localized layouts are not claimed as supported. Exactly one saved project
  must be open; playback/recording must be stopped.
- Select one header through `AXSelectedChildren`, verify readback, export into a
  unique private subfolder, then proceed to the next. Duplicate names cannot
  collide. At completion restore and verify the original selected track indices.
- Set WAVE/24-bit, extend to project end, effects and volume/pan automation on,
  normalization off, tails off, tempo information on, add-to-project off. These
  become Logic's last-used export dialog settings; the filename pattern is left
  unchanged. This is track export, not the master mix; send/master processing is
  governed by Logic's own track-export behavior.
- The displayed range is semantic, not guessed samples. Actual WAV rates/lengths
  are read after rendering. Require equal positive lengths/rates, 24-bit mono or
  stereo, selected-ID coverage, restored selection and a total below 300 MB
  before an archive can exist. Preserve leading silence and embedded WAV chunks.
- Cycle selection, moved project starts, external-hardware rendering and
  arbitrary window/localization combinations are not qualified. No automated
  click-through of unexpected prompts. No content edits, solo toggling, project
  save, or new track creation are used. Don't interact with Logic during export.
- A timeout/uncertain restoration retains the lock and journal. There is no
  blind render retry or automatic stale-lock deletion. Inspect the host first.
- Track selection is restored; export dialog preferences may change as described
  above. Region selection, keyboard focus and view scroll position are not
  guaranteed to match the original UI after selecting tracks.

## Verification

`node --experimental-strip-types --test packages/track-export/test/*.test.mjs`
runs offline tests (including identity mismatch, duplicate names, unequal audio
lengths, symlink escape, stale IDs and restoration refusal). `inspect-logic.mjs`
is read-only host discovery. `test-logic-host.mjs` deliberately refuses any
project except the synthetic `Orb Logic Region QA` project. It exports its first
two tracks locally, without uploading or altering project content.

Do not enable another host in native capabilities until its renderer, destination
handling, exact track mapping, failure cleanup and real-host test have passed.
The adapter separation keeps existing PTSL/LUNA behavior intact while each new
host is qualified independently. An all-DAW implementation remains in progress.

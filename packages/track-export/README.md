# Slur Chat — DAW track export

## Supported adapters

| DAW | Track list | Offline export | Installation / limits |
| --- | --- | --- | --- |
| Pro Tools 2026.4 | Native PTSL IDs | Entire audio session / timeline selection | Licensed PTSL SDK staged locally |
| LUNA 3.0.0 on macOS | Native track UIDs; no StemLink | Entire session, audio/instrument tracks | Built-in local service; no screen automation |
| REAPER | Not connected in this release | Pending | Older experimental ReaScript needs rework and real-host tests |
| Logic, Cubase/Nuendo, Live, Bitwig, FL Studio, Studio Pro, Mixbus | Not connected to this picker | Pending | Do not report the old MCU bank list or an opened export dialog as automatic export |

LUNA does not yet support timeline selection or buses through this adapter.
Its local API is host-version dependent, not a cross-DAW plugin standard.
Read failures, missing ranges, real-time-only renders, session switches, missing
files and short output fail closed. Extra render blocks are cropped to the
displayed session end without shifting samples or re-encoding. No silence is
invented to hide a short render. All output is Float32 WAV as rendered by LUNA.
The existing chat uploader is shared by both adapters.

The installed native build advertises adapter capabilities; older builds retain
Pro Tools-only behavior. Standalone exposes an explicit DAW selector so it never
guesses which of two open DAWs the user means.

Architecture: picker → native private job → selected DAW adapter → validated
WAV/archive → existing chat uploader. Jobs serialize host renders with local
locks. An uncertain LUNA abort retains its lock/journal rather than starting
another render. No host project, mixer routing, selection or track is edited
by the export adapter. LUNA's render service updates internal media bookkeeping.

Revisit for broader distribution: a bundled runtime instead of Homebrew Node,
per-version host conformance tests, bounded parallel track reads, and a supported
range API for LUNA before enabling its selection option. New adapters must
preserve stable IDs and validate samples before opting into the native capability
list. Do not automatically fall back to playback recording or UI automation.

Real-host verification: synthetic LUNA session with duplicate track names and
three mono sources at different positions/lengths; 48 kHz post-pan stereo exports
validated at the same 307840-frame length without adding project tracks. The
guarded command below never uploads or sends a message:

```sh
node packages/track-export/test/liveLunaTracks.mjs
```

For LUNA-only local installation, run `node packages/track-export/install.mjs`;
the Avid SDK is only needed for the Pro Tools adapter.

## Pro Tools adapter

In Pro Tools, the native chat-composer track-list button uses PTSL, not screen automation or
StemLink. It reads real track IDs, bounces checked tracks offline, validates the
WAV files, and sends one multi-audio attachment using the existing upload path.
The sender checks the destination again before sending; failed renders/uploads
never send a partial message. Source track IDs and sample positions are retained
in the attachment; existing clients can play the ordinary multi-audio entries.

Local developer installation (macOS, Node 22.6+, separately licensed Avid SDK):

```sh
SLUR_PTSL_SDK=/path/to/licensed/PTSL_SDK node packages/track-export/install.mjs
pnpm --filter @slur/track-export test
```

The helper lives in `~/Library/Application Support/Slur/TrackExport`. The local
installer stages PTSL.proto from the user's licensed SDK alongside the helper,
so DAW-launched workers do not need runtime access to a development folder.
The licensed protocol is not checked into Git or distributed. This is a developer-machine
installation, not a self-contained public installer. Plugins also need the
matching native `TrackExportBridge` and deployed frontend.

Supported: Pro Tools 2026.4 verified; mono/stereo audio, instrument, aux and routing
folders. Up to 64 tracks / 300 MB. Encoding follows Track Bounce preferences and
is inspected after rendering. Split-mono/multichannel output is not accepted.

Entire session uses session start to the last audio timeline clip (not the default
24-hour session length). If MIDI/instrument clips are present, choose a full-song
timeline selection instead: MIDI boundaries are not in the audio EDL. Add effect
tails through a longer timeline selection. Shared returns/master processing are
not automatically included per track. External hardware may require real-time
export, which is not silently substituted.

WAV duration/path/format, session identity, selected IDs and range are validated.
Private per-job journals record completed tracks. Interrupted jobs retain the
shared Pro Tools transfer lock for inspection instead of automatically retrying.

The original experimental region/Logic bridge is intentionally NOT included in
this release integration; ordinary drag/drop and the collaborator's latest UI/FX
code remain unchanged.

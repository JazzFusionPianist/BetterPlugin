# Slur Chat — Pro Tools track export

The native chat-composer track-list button uses PTSL, not screen automation or
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

The helper lives in `~/Library/Application Support/Slur/TrackExport`. It references
the SDK in place and does not redistribute it. This is a developer-machine
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

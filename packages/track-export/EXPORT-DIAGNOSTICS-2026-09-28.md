# Drum Bus export diagnostics

## Observed, not inferred

- Timeline selection job `eede467695a34d8394808e6b9c98142c` finished rendering:
  range 3125017–6755989 at 48 kHz. The journal is complete and the WAV is
  21,903,010 bytes. Nothing indicates a routing-folder export failure in this job.
- The bundled page loads at JUCE's local resource origin. Its relative
  `/api/r2-upload-url` previously pointed to that origin, which only serves bundled
  static files. The upload callback swallowed the error and showed a generic text.
- Entire-session job `6661c4b2779b4ec4b596c4d72ed12f29` requested 0–15892944 at
  48 kHz. It remains in `exporting`, with a 1,024-byte WAV header and no completed track.
- A process sample shows Pro Tools' main thread in PTSL_BounceTrack →
  PrimeForOfflineBounce → CoreAudio StopIOProc → mutex wait; the audio IO thread
  waits in AAE DoAllProcessing. Slur's helper thread waits for its worker process.
  This locates the stall but does NOT establish the underlying driver/plugin trigger.
- PTSL registration and native UI inspection both time out in the stalled process.

## Changes

- Resolve upload and presigned-read API routes to the production server when the
  page is bundled; keep web/dev requests same-origin. Server OPTIONS and storage
  OPTIONS accept origin `null` (204), and the upload presigner returned 200.
  Diagnostic generated no uploaded object and sent no chat message.
- Upload preparation timeout 30s; data upload timeout 180s; specific stage errors.
  Retry upload reuses the completed archive (tested with a mock native bridge).
- Bounce requests specify session-rate, 24-bit, interleaved PCM explicitly.
  This removes inherited format ambiguity; it is not claimed to fix the engine stall.
- Timed-out/failed in-flight bounce retains the host lock; no automatic realtime
  fallback, repeated bounce, engine reset, or force quit.
- Idle export dialog polls only GetSessionIDs, GetSessionSampleRate and
  GetTimelineSelection at about one-second intervals. No EDL/track scan per poll.
  Polling stops while closed, exporting or uploading. Selection is refreshed once
  more at submit and then frozen; the helper rejects later range changes.

## Remaining qualification

The existing user session was not closed, force-quit or edited to resolve the hang.
After safe host recovery, compare manual vs PTSL Drum Bus offline bounce in a copy
of the session, then isolate playback-engine/plugin dependencies if still blocked.
Actual host upload/placement verification is pending that recovery. Mocks and web
build success are not evidence that the CoreAudio stall is fixed.

# Slur Games follow-up verification - 2026-10-12

Source baseline: `556e376`, plus the current uncommitted game fixes. Concurrent
DAW/track-export work was preserved, not reverted or included in a commit here.

## Additional fixes

- Falling Blocks quit now waits for the player-state write to succeed before
  marking the local game over. Rejected writes retain a retryable confirmation.
  The room-finish write is also acknowledged before closing the view. Explicit
  quit does not additionally trigger the natural top-out finish effect.
- Yacht's filled turn indicator and Ear Training's selected-answer label now
  have a dark fallback foreground in compact plugin rooms, which do not define
  the web/arcade `--gwall` token. Previously the foreground could inherit the
  same light color as its filled background.
- The isolated QA harness disconnects speaker output by default. Game audio
  scheduling still runs; production audio and system preferences are unchanged.

## Results

| Check | Result |
| --- | --- |
| Chrome layout matrix | 210 screen states, zero failures |
| WebKit layout matrix | 210 screen states, zero failures |
| Chrome/WebKit interaction regressions | Passed |
| Quit controls across all available games | Passed with in-memory transport |
| Failed Chess/Falling Blocks quit and retry | Passed with injected write failures |
| Fresh entry versus explicit Falling Blocks resume | Passed; locked board, queue and score preserved for the exact local match |
| Ear Training computer game | Both clients complete all 10 rounds without database room writes |
| Yacht computer match quit and turn contrast | Plugin/web, Chrome/WebKit passed |
| Web static production build | Passed |
| iOS simulator current-source build/install | Passed, existing app data retained |
| Android signed release build/install | Passed on the owned emulator, existing app data retained |

The layout checker now distinguishes content reachable through a bounded local
scroller from actual ancestor clipping. It separately measures the poker
scroller itself; the interaction regression checks betting-control reachability.
The initial one-failure-per-engine result was this false positive, not a hidden
poker action after the existing local-scroll fix.

Installed iPhone verification includes the signed-in chat flow without any key,
device-enrollment or unlock screen, and a full-width Chess lobby instead of
automatically resuming an old match. The installed app must be restarted after
an update; merely launching an already-running process retains its old page.

## Limits

- Plugin TypeScript and the standard native build are blocked by concurrent
  track-export work: `apps/plugin/src/lib/dawTrackExport.ts:21` still declares
  the previous DAW union while `TRACK_EXPORT_DAWS` contains REAPER and Slur Tap.
  No stale AU/VST3 bundle was reinstalled as a substitute for the new source.
- Android startup/install was checked, but no signed-in Android test session
  was available. The installed post-login Android flow is not verified.
- No physical-device IPA or AAX build was produced. Native DAW interactions,
  two-account multiplayer, reconnect/conflict resolution, and complete game
  rule correctness are not established by the in-memory browser harness.
- No production deployment was performed. The hosted web and macOS desktop
  are not updated by local static/native builds.

Reports/screenshots are under ignored `artifacts/games-audit/verified-final-*`.
Current-source Android and static-web downloads are refreshed under
`artifacts/games-audit/downloads/`; older plugin downloads are not a release
candidate for this follow-up.

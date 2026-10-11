# Slur Games audit - 2026-10-11

Baseline: `0e14a97`. Findings below were reproduced or verified in source and
fixed locally. No commits, production deployment, or public release were made.
The pre-existing change to `supabase/.temp/cli-latest` was left untouched.

## Findings and fixes

| Priority | Finding | Fix |
| --- | --- | --- |
| P1 | Mounted but hidden games kept window-level arrow/space listeners and native keyboard capture active, interfering with other screens and the DAW. | Shared visibility lifecycle releases keyboard ownership and held controls when a game is hidden. |
| P2 | Large arcade layouts were selected from window mode rather than actual available pane dimensions. At 600x500, chess could collapse to an 80px board; poker actions extended beyond the pane. | Measure the host and use the wide room layout only when the game has at least 1000x600 available. Resize keeps the same game mounted. |
| P2 | Web compact chess header and chat minimum sizes competed with the board, distorting it and clipping the input. | Explicit header/board/chat grid with a square contain-fit board. |
| P2 | Native WebKit could shrink the implicit chess grid column to its contents, clipping the lobby into a narrow strip. | Explicit full-width grid track and measured square board dimensions. Verified in the installed iOS simulator. |
| P2 | Dark game backgrounds made blue turn indicators and red danger labels difficult to read. | Theme foreground for turn status; light coral text on solid dark red danger buttons, with a 4.5:1 contrast regression. |
| P3 | Game buttons forced lowercase labels; Falling Blocks used a wrapping End game label and Chess used draw?. | Shared sentence-case game buttons across all game views. Falling Blocks uses Quit/Reset; Chess uses Resign/Draw. |
| P2 | Three Falling Blocks opponents were flex-shrunk vertically without matching width changes. | Allocate equal-height opponent slots and contain-fit each 10x20 board independently. |
| P2 | Poker betting controls could extend below a short pane, particularly with maximum computer count. | Short wide panes use a two-column table/self layout; smaller panes retain local scrolling rather than clipping controls. |
| P2 | Game chat fetched the oldest 80 messages and realtime history grew without a bound. A late history response could overwrite realtime inserts. | Fetch newest-first, merge by ID, render chronologically, and cap the latest 80 messages. Guard asynchronous sends and subscriptions by room. |
| P2 | Chat `scrollIntoView` could scroll the containing game screen and always pulled readers away from older messages. | Scroll the chat container only, and follow new messages only when pinned near the bottom. |
| P2 | Rapid game selection or navigation during an asynchronous room lookup could restore an earlier selection or leave a stale join-room ID. | Selection generations cancel outdated results in standalone, studio, legacy plugin, and web selection paths. Clear stale join IDs. |
| P2 | Hard Minesweeper's centered overflow put the first columns left of the reachable scroll origin. Invalid persisted difficulty could crash startup. | Start-aligned scrolling with auto centering when space permits; validate saved difficulty. Sudoku also validates its saved difficulty. |
| P2 | Wide Ear Training padding increased its declared width past the host; result cards could exceed short panes. | Scoped border-box sizing and scrollable result cards. |
| P2 | Pinball flippers/plunger could remain held after losing focus. | Release held keys on blur and effect cleanup; ignore composing and modified shortcuts. |
| P3 | Hidden solo canvases and timers continued running; Orb Merge read computed styles in every animation frame. | Pause solo loops/timers when hidden or while relevant confirmation dialogs are open. Cache canvas palette and refresh on theme/size changes. |

Multiplayer Falling Blocks gravity deliberately continues while the pane is
hidden: switching away must not let a player pause a live match. Realtime room
subscriptions remain alive when screens are hidden.

## Key locations

- `packages/core/hooks/useGameSurface.tsx`: visibility, host measurements, palette.
- `packages/core/hooks/useGameChat.ts`: bounded room-scoped chat state.
- `packages/core/components/GameButton.tsx`: sentence-case game button labels.
- `packages/core/styles/games.css`: scoped layout fixes shared by plugin and web.
- `apps/plugin/src/pages/GamesPage.tsx`: standalone game selection.
- `apps/plugin/src/pages/StudioShell.tsx`: studio game selection/invite guard.
- `apps/plugin/src/pages/CollabPage.tsx`: legacy game selection/visibility.
- `apps/web/components/games/GamesPanel.tsx`: web/native game selection and visibility.
- `tests/games/`: reproducible local QA harness and browser regressions.

## Verification

- Layout matrix: 210 lobby/play states per engine, Chrome and WebKit, 5 sizes,
  plugin 13 games and web 7 games; 420 states with zero failures.
- Korean embedded-pane matrix: 42 states at 600x500.
- Additional poker matrix: 20 states, including phone and short landscape panes.
- Chrome and WebKit regression: button captions and danger contrast, hidden input, responsive chess without room reset,
  interactive pinball canvas, four-player Falling Blocks proportions, maximum
  computer-count poker controls, hard Minesweeper, saved settings, and game chat.
- Plugin and web TypeScript checks; web static production build.
- Universal macOS Slur Games and Slur AU/VST3 builds and targeted AU validation.
- Current-source iOS simulator and signed Android release builds.
- iPhone simulator and Android emulator installs preserve existing app data.
- iOS signed-in chat opens without key input, device enrollment, or unlock UI.
- Installed iOS chess lobby and computer game verified: full-width lobby,
  square board, readable turn status, Resign and Draw captions.

Screenshots and JSON measurements are local ignored artifacts under
`artifacts/games-audit/`. Re-run instructions are in `tests/games/README.md`.

## Remaining coverage and optimization opportunities

- Real two-account invite, reconnect, conflict resolution, and multiplayer
  server behavior need separate end-to-end tests. The mock transport does not
  establish their correctness, nor the complete rules of every game.
- Android has no signed-in test session, so its installed post-login flow is
  not verified. No physical iOS signing/profile was available for an IPA.
- AU validation is not a substitute for signed-in game interactions inside
  Logic, Pro Tools, or another real DAW. AAX was not built or tested here.
- macOS desktop loads the hosted web app. It will not receive local source
  changes until the reviewed web build is deployed.
- Web/iOS/Android currently expose seven games; six additional games are
  plugin-only. This is existing product parity, not a regression introduced here.
- Static game imports in the studio/standalone hosts are a future opportunity
  for deferred loading. That requires cold-start measurements and native
  WebView chunk-loading tests before changing production loading behavior.
- Dedicated deterministic rule-engine tests and automated accessibility checks
  remain useful follow-ups. This pass focuses on layout, lifecycle, and chat.
- Native iOS minimum is 15.0, whereas container query units arrived in Safari
  16 ([Apple release notes](https://developer.apple.com/documentation/safari-release-notes/safari-16-release-notes)).
  New board-sizing rules include guarded viewport-based fallbacks. Actual iOS
  15 and older macOS WebViews were not available for verification; existing
  arcade layouts also need a separate compatibility pass there.

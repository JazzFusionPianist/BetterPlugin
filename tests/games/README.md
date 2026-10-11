# Slur Games QA

This harness renders the real plugin and web game components with isolated CSS
and an in-memory transport. It never connects to the production database or sends
real chat messages, invites, or leaderboard submissions.

Audio output is disconnected in this test harness by default, including hidden
browser runs. Production game audio and system sound settings are unchanged.
Append `&audio=1` to a visible fixture URL only when intentionally checking sound.

## Run

From the repository root, start the harness in one terminal:

```sh
pnpm dev:games:qa
```

With Playwright available, run in another terminal:

```sh
pnpm test:games:layout
pnpm test:games:regression
pnpm test:games:lifecycle
pnpm test:games:chess3d:rules
pnpm test:games:chess3d
```

If Playwright is provided by a separate runtime, set `PLAYWRIGHT_MODULE` to its
`index.mjs`. Set `CHROME_PATH` when using an installed Chrome instead of a
Playwright browser. `GAMES_QA_URL` overrides the default localhost port 5191.
Set `GAMES_QA_ENGINE=webkit` to run the same tests with Playwright WebKit.

## Coverage

- Plugin: 14 games; web/mobile source: 8 available games. Chess(3d) has its
  own shared-renderer test in addition to the original 13/7-game matrix.
- Layout matrix: 300x500, 600x500, 1200x800, 390x844, and 844x390.
- Lobby and computer/solo play, long player names, and populated leaderboards.
- Runtime errors, ancestor clipping, document overflow, and nonblank canvases.
- Hidden keyboard capture, interactive pinball canvas, resize without room reset.
- Sentence-case Quit/Reset and Resign/Draw captions; danger-button contrast.
- Four-player Falling Blocks board proportions at compact and wide sizes.
- Maximum-count poker controls, including short-pane scroll reachability.
- Reachable first column of hard Minesweeper and invalid stored difficulty.
- Latest 80 game-chat messages, bounded realtime history, local scrolling,
  and subscription isolation after switching rooms.
- Quit controls in every game, failed termination and retry, fresh lobby entry,
  explicit Falling Blocks resume, and complete Ear Training computer matches.
- Chess(3d): wood textures and nonblank scene pixels, framing, raycast moves,
  computer replies, camera gestures, hidden-pane input, invite/resume metadata,
  failed resign and retry, and a playable fallback without WebGL.

The 3D browser test additionally requires `SHARP_MODULE` pointing to an installed
Sharp entry point when it is not available in this workspace.

Use `GAMES_QA_LANG=ko GAMES_QA_EMBEDDED=1 GAMES_QA_QUICK=1` for a compact Korean
embedded-pane check. `GAMES_QA_GAMES=chess,poker` selects games.
`GAMES_QA_TAG` selects an artifact subdirectory (default `full`). Screenshots
and JSON measurements are written under ignored `artifacts/games-audit/`.

Direct fixtures:

```text
http://127.0.0.1:5191/?platform=plugin&game=falling_blocks&players=4&arcade=1
http://127.0.0.1:5191/?platform=web&game=chess&arcade=1
```

This is not a substitute for two-account network matches, authoritative server
rules, accessibility testing, or interaction inside a real DAW/native WebView.
Native builds must also be built from the same source and checked separately.

# Slur Games QA

This harness renders the real plugin and web game components with isolated CSS
and an in-memory transport. It never connects to the production database or sends
real chat messages, invites, or leaderboard submissions.

## Run

From the repository root, start the harness in one terminal:

```sh
pnpm dev:games:qa
```

With Playwright available, run in another terminal:

```sh
pnpm test:games:layout
pnpm test:games:regression
```

If Playwright is provided by a separate runtime, set `PLAYWRIGHT_MODULE` to its
`index.mjs`. Set `CHROME_PATH` when using an installed Chrome instead of a
Playwright browser. `GAMES_QA_URL` overrides the default localhost port 5191.
Set `GAMES_QA_ENGINE=webkit` to run the same tests with Playwright WebKit.

## Coverage

- Plugin: all 13 games; web/mobile source: all 7 available games.
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

# Slur embedded login failure — 2026-09-24

Status: root cause confirmed; corrected AU and VST3 rebuilt and installed at
04:19 KST. Logic project saved and host restarted; replacement AU opened successfully.
User password entry and successful sign-in confirmation remain outstanding.

The Logic Pro AU displayed `something went wrong — try again` at login. Its
WebView loaded `juce://juce.backend/index.html` (the carried page in the plugin),
not the current hosted web page. No corresponding login request reached Supabase.

The installed product originated from the `slur-chat-track-export` worktree.
Its carried Vite bundle (`index-oW8_Gdox.js`, build `951204f`) contained
`null.auth.signInWithPassword(...)`, and no Supabase project URL. The build had
not received `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The client factory
returned null; the login handler's non-null TypeScript assertion did not protect
the runtime call. This occurred before network authentication, independently of
the administrator authorization migration applied at 18:53 UTC.

Fixes:

- Set only the two existing public client configuration variables in the build
  worktree's git-ignored `apps/plugin/.env.local`. No service credential copied.
- Added a Vite build guard to reject missing login configuration.
- Added an explicit missing-configuration message before invoking auth.
- Applied those source guards to both the build worktree and security workspace.

Validation so far:

- Supabase auth health and settings endpoints returned HTTP 200; email enabled.
- A build with deliberately empty auth configuration failed at the guard.
- Corrected bundle `index-DOZiQRX6.js` contains the intended Supabase URL and no
  `null.auth.signInWithPassword` call.
- Saved and reopened the existing Logic project. No password was read or changed.
- Both installed bundles passed `codesign --verify --deep --strict`.
- Previous bundles were preserved in
  `/Users/jasonpark/.codex/backups/slur-login-20260924-041919`.

The installed AU must be reloaded by restarting the host after saving its project.
End-to-end login must be confirmed after the host loads the replacement binary.

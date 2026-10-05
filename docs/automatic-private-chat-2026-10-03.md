# Automatic Private Chat: Staged Implementation

## Status

**Superseded on 2026-10-06:** the product decision is account-authorized chat,
not E2EE. Production entry points no longer use this staged sending/enrollment
flow. The implementation and tests below are retained as historical work, not
as a current privacy promise. See `account-chat-default-2026-10-06.md`.

Local implementation and automated verification only. **Not a production E2EE
cutover, not an independently audited messaging protocol, and not installed.**
The production account-chat release still permits operator-readable message
records and attachment keys. Nothing in this change deletes or retrospectively
protects that existing history or its backups.

The additive migration defaults `private.chat_rollout.enabled` to false. This
client does not send plaintext even while that flag is false; it reports that
Slur is updating. Do not deploy this client alone against the existing schema,
or flip the flag without coordinating all writing clients. Ordinary historical
plaintext remains readable, explicitly without a claim of retroactive privacy.

## Implemented

- Automatic identity creation only after durable local storage and readback.
  Existing identities are never overwritten when another device signs in.
- Keychain on macOS; a non-exportable WebCrypto wrapping key in browser storage.
  No master/recovery secret is displayed to the user or stored on the relay.
- New-device approval transfers the identity encrypted to a short-lived
  ephemeral public key, signed by the existing identity. The user compares the
  full one-time 128-bit connection code out of band. A six-digit public checksum
  is deliberately not used: a malicious relay could grind a matching key.
- Optional HTTPS WebAuthn PRF backup, requiring user verification. The server
  stores an authenticated encrypted vault, public identity and credential ID,
  never the PRF output or unwrapped master. This is key restoration after normal
  login, not a replacement for Supabase authentication.
- Message bodies, attachment URLs/keys, names and region metadata are encrypted
  before insertion. File bytes were already encrypted locally by `secureFiles`.
  Files and game invitations use the same send path as ordinary conversation text.
- Recipients who have not yet initialized are handled using an owner-only,
  self-encrypted outbox. UI shows waiting, not sent/read. Re-login restores the
  outbox; periodic retry delivers when recipients are ready. No network failure
  or feature flag permits a plaintext fallback in this client.
- Recipient membership is snapshotted before queueing and rechecked before
  delivery under the conversation lock. Changed membership blocks the draft;
  it is not automatically sent to newly added participants.
- Atomic outbox delivery/cancellation with durable terminal receipts. Cancellation
  first prevents late delivery; delivery first reports already sent. Entire stem
  bundles, file references and receipt changes commit together or roll back.
  Direct legacy inserts cannot revive an ID reserved by an outbox receipt.
- Lost delivery responses are resolved from receipts. Lost initial queue responses
  are recovered only when the stored draft matches the exact signed envelope;
  an unrelated ID collision cannot substitute content. If both the insert response
  and confirmation read fail, status remains uncertain until reconnect/polling.
- Pending items show waiting/retry/cancel controls, blocked membership/errors and
  seven-day expiry without cryptographic terminology. Cancellation on another
  device refreshes mounted views. A failed item does not stop later queued sends,
  and unreadable pending content does not hide the delivered conversation history.
  Expired drafts retain owner-only ciphertext until cancelled, but release file
  retention references; their attachments may need to be uploaded again.
- Pending file references prevent ordinary garbage collection, without granting
  recipients access or allowing them to reuse those references prematurely.
- Conversation previews, notifications and shared-file lists decrypt locally.
  Encrypted messages do not automatically invoke server-side URL unfurling or
  the chat-to-AI schedule chip. Calendar entries explicitly created outside
  private messaging remain outside this encryption scope.
- Native hosted-page auto-upgrade disabled; on macOS, only the bundled main
  frame can call the privileged bridge. Hosted CAPTCHA code is subframe-only.
  `build.json` no longer advertises the old account-chat contract, preventing
  compatible recent old binaries from auto-navigating to this incompatible UI.
- Envelope serialization allowlists public recipient fields. Passing a full
  local identity object cannot accidentally copy its private keys into a message.

## Security Boundaries

This reuses Slur's version-1 libsodium envelope for historical compatibility:
Ed25519 signatures, secretbox payload encryption and sealed per-recipient keys.
It is **not Signal or MLS**, has no forward secrecy or post-compromise security,
and shares one account identity among linked devices. Revoking a login does not
erase a key already held by that device; proper identity epochs/rotation and
device-level revocation require further protocol work.

The DB/storage operator cannot decrypt the new records merely by inspecting
those records and vaults. This is narrower than protection against an actively
malicious service or software distributor. First-contact key substitution is
not prevented by existing trust-on-first-use pinning. Key transparency or an
independently authenticated identity mechanism is still required for that claim.
Web-delivered JavaScript can be replaced by its operator. A signed native app
also ultimately trusts its release distributor and the endpoint OS. Native
bridge isolation reduces the hosted-code exposure; it does not solve all of
these trust problems.

Participant IDs, timestamps, conversation membership, object identifiers and
file sizes remain metadata visible to the server. Public profiles, game-room
chat, shared calendars and notes are not covered by this private-message path.
Recovered legacy ciphertext is still limited to identities that can decrypt it.

## Release Gates

1. Independent protocol/security review, especially identity authenticity,
   device compromise/revocation and migration from plaintext clients.
2. Physical passkey tests on supported Apple/browser versions and two actual
   devices. Chromium's virtual authenticator does not establish iCloud Keychain,
   Touch ID, Safari/WKWebView or cross-platform support. Native custom-scheme
   windows currently use existing-device approval, not WebAuthn directly.
3. Finish the all-devices-lost flow. Losing all connected devices and passkeys
   cannot be solved by the operator reading old history. A separately designed
   identity reset may enable future messages, but must not silently lose or
   misrepresent old history. No automatic destructive reset is implemented.
4. Background expiry/retention maintenance. Cancellation, seven-day expiry,
   status controls and atomic delivery are implemented locally. Expiry currently
   runs on sender reads/delivery; offline senders retain pending file references
   until reconnecting. Terminal receipts are retained to prevent resurrection.
   Define bounded maintenance without invalidating that guarantee. Polling needs
   a sender device online; the server does not decrypt or re-encrypt outbox items.
5. Real Postgres/PostgREST staging verification and all-platform client update
   coverage. The isolated PGlite fixture verifies SQL functions and RLS, not
   Supabase deployment configuration or real Realtime delivery. Outbox tests
   exercise both serialized send/cancel orders, not simultaneous PostgreSQL
   connections or deadlock behavior under production load.
6. A coordinated, approved cutover with rollback that does not re-enable
   plaintext writes. Preserve existing data; do not promise old backups vanish.

## Local Verification

- `pnpm test:security`: 68 tests, covering SQL/RLS, device transfers, PRF vault primitives, send
  pipeline, tampering, missing recipients, membership changes, account changes,
  duplicate retries, explicit plaintext rejection and native bridge isolation.
- `pnpm typecheck:plugin` and `pnpm --filter web typecheck`.
- `cmake --build Plugin/build --config Release --target OrbChat --parallel 2`:
  shared native code compilation only, not a newly packaged/installed AU.
- `apps/plugin/tests/device-connection.html`: synthetic local identities only.
  `tests/security/deviceConnection.browser.mjs` exercises 320/1100px layouts,
  absence of recovery secrets, silent ready state and virtual WebAuthn PRF
  creation/restoration. Start Vite on 127.0.0.1:5189; provide `PLAYWRIGHT_MODULE`
  and `CHROME_PATH` when using a separately bundled browser runtime.
- The same browser runner verifies pending-send statuses, cancellation success,
  already-delivered responses, network failure notices and 320/1100px layouts.
- `tests/security/deviceRelay.browser.mjs`: two isolated Chromium contexts with
  independent IndexedDB stores and a synthetic relay. Wrong-code approval fails;
  correct approval unlocks existing ciphertext and survives a page reload without
  sending the master secret to the relay or displaying it. This is not a physical
  two-device or live Supabase integration test.

The follow-on `20261003112523_private_chat_outbox_lifecycle.sql` is additive and
also does not enable cutover. Both private-chat migrations must precede this
client. Transaction boundaries follow PostgreSQL's row-lock behavior; see the
[PostgreSQL locking reference](https://www.postgresql.org/docs/current/explicit-locking.html)
and [Supabase function security guidance](https://supabase.com/docs/guides/database/functions).

No real conversations or files were sent during these tests. No production
migration, deployment, plugin reinstall, commit or push was performed.

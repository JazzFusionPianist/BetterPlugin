# Account-Based Chat

This supersedes the mandatory device-key chat rollout described in the September
security documents. Users sign in to access chat and files; there is no recovery
code, identity provisioning gate, or requirement that recipients prepare a key.

## Security Model

- New message bodies and attachment metadata are stored in conversation-member-only
  database records. They are not end-to-end encrypted against the service operator.
- Audio and other private uploads retain authenticated file encryption. The random
  per-file key travels in the member-authorized attachment reference, not in a
  device identity envelope. Anyone with database access to that record can decrypt
  the associated file; do not market this as operator-inaccessible encryption.
- HTTPS, active-session checks, RLS, sender/uploader ownership, membership checks,
  quotas, rate limits, immutable upload validation and private signed downloads
  remain enforced. Signing out or revoking a session removes future server access.
- Existing device keys and ciphertext are preserved. Legacy records may use an
  already-remembered key; ordinary account records never fetch participant keys.
- Old clients may still send legacy envelopes through the existing strict validator.
  They cannot migrate shared account history back to device-bound ciphertext.

## Rollout And Verification

Migration: `20261002193130_account_based_chat.sql`. Apply before shipping the new
client. `build.json.accountChat = 1` prevents updated native clients from loading
an older hosted UI that reinstates key onboarding.

`tests/security/account-chat.test.mjs` verifies keyless accounts, subsequent login,
private-file decryption using only member-authorized record data, stem metadata,
outsiders, revoked sessions, forged senders and file references, invalid payloads,
legacy envelope validation, and game invitations.

At cutover, production contained zero encrypted message or stem records. No user
history was deleted or converted. Supabase RLS and trigger definitions were checked
after migration; the public file resolver still returns HTTP 401 without sign-in.

Do not roll back by reinstating mandatory encryption triggers: account-authenticated
records now exist. A rollback must retain account-record read/write compatibility.
Already-open old plugin instances need to be reopened with the updated AU/UI.

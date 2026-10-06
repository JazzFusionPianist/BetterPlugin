# Attachment Retention

## Behavior

- New chat/stem uploads: free seven days; active paid subscribers three calendar
  months. UTC calendar arithmetic preserves month boundaries (Jan 31 to Apr 30).
- The uploader's entitlement at upload reservation determines a fixed deadline.
  Receiver subscriptions, forwarding and later upgrades/cancellations do not
  change that deadline. Re-uploading bytes creates a new object/deadline.
- Existing private/legacy attachments receive seven days from migration application
  (or three months if the uploader already has a trusted active entitlement).
  Existing files are not deleted immediately based on old creation timestamps.
- Public profile/portfolio assets are exempt. Ordinary message text and region
  metadata remain in history; file bytes expire. Downloaded local copies remain.
- At expiry, new download grants and new sharing references are rejected. Signed
  R2 and legacy Storage URLs are capped to the remaining lifetime, up to five minutes.
- The existing five-minute cleanup schedule claims expired files even when they
  still have message/stem references. Physical deletion is asynchronous, retried
  on failure and batched at 25 R2 and 25 legacy Storage objects per invocation.
  An outage or backlog delays byte removal but not new authorized downloads.
- UI uses server deadlines for expired-message/stem placeholders and updates an
  already-open screen within 30 seconds. Public-file deadlines are null. A mixed
  message is fully expired only after all tracked assets expire. In Files, expired
  bundle members are listed separately so surviving files can still be downloaded.

## Future Billing Integration

`private.attachment_retention_entitlements(user_id, paid_until)` is a private,
server-writable table. It has no user write/read grants and is not based on editable
profile/JWT user metadata. The future verified billing webhook can call
`set_attachment_retention_entitlement(p_user, p_paid_until)` with server credentials
only for an active entitlement, and pass null to remove it when the entitlement
ends. This RPC is executable only by service_role. There is no payment provider,
checkout or billing webhook in this change.
Until that integration is implemented, ordinary accounts receive seven days.

Do not shorten an existing file deadline after cancellation; it is an upload-time
promise. No automatic recovery or extension of already expired files is implemented.

## Deployment

Apply `20261005195136_attachment_retention.sql` after the account-chat, outbox and
legacy-storage migrations. Deploy the updated cleanup/download APIs and clients
together. The first cleanup after deployment may schedule existing orphan or
deleted-account objects as before; referenced historical files get the grace above.
Ensure CRON_SECRET and the existing Vercel cron are active. The worker needs access
to both R2 buckets and Supabase Storage for older attachments.

The privacy page is a 2026-10-06 draft describing these periods and future paid
support; its effective date must be announced when the policy is actually released.
This implementation was verified locally; no production migration, storage deletion,
deployment, installation, commit or push was performed.

## Validation

Isolated SQL tests cover free/paid boundaries, active/expired entitlements, no
client privilege escalation, month-end arithmetic, public exclusions, grace,
member/session authorization, forwarding rejection, deletion of referenced files,
durable retry and legacy Storage expiry. API tests check 410 responses and short
signed grants. Presentation tests check single/mixed/unlimited files and invites.

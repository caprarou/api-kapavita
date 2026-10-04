# KV.gr Security Foundation

## Rules

- Production secrets, API keys, credentials and WebAuthn private material stay server-side and
  outside Git.
- Every route and entity query is deny-by-default and checked on the trusted service layer.
- Roles are not permissions. A role can provide defaults, but entity grants and consent still apply.
- Admin does not imply access to another user's location, private documents or family history.
- Sessions are revocable and associated with a device record; logout, password reset, risk response
  and admin revocation must invalidate the appropriate sessions.
- Security events are structured and append-only enough for investigation. Never log passwords,
  bearer tokens, recovery codes, API keys, raw location coordinates or full financial payloads.
- Connector failures preserve the last verified state with an explicit stale/error marker; they do
  not reset values to zero or fabricate success.
- Caddy, systemd, database and backup changes are project-scoped and reversible.

## Required verification

The foundation must test unauthenticated access, role boundaries, entity grants, cross-user reads,
location consent, session revocation, CSRF, cookie flags, audit redaction, connector error states,
build output and rollback health probes before the staging URL is handed over.

# KV.gr Decision Log

## 2026-10-04 — Reuse the existing KapaVita base

The repository already has React/Vite, a working Caddy-served SPA, a Python admin service,
password/session/CSRF/audit primitives, and deployment documentation. The foundation should extend
those boundaries after live inspection instead of introducing a parallel application or proxy.

## 2026-10-04 — No direct Homarr fork

Homarr is an Apache-2.0 dashboard with useful UX patterns and a public security history, but KV
needs its own entity, consent and permission semantics. We will use the product as a reference and
evaluate a focused grid library for the layout engine. Copying product code would increase upgrade,
license and security review cost.

## 2026-10-04 — Candidate reuse audit

- `react-grid-layout/react-grid-layout`: MIT, active, mature React grid; candidate for the widget
  layout engine. Pin a reviewed version and keep persisted layouts server-side.
- `pennersr/django-allauth`: MIT, active, battle-tested account flows with MFA/passkey support;
  candidate only if the server inspection justifies a Django boundary.
- `django-otp/django-otp`: Unlicense, active OTP framework; candidate for TOTP only after review of
  operational and legal fit.
- `duo-labs/py_webauthn`: BSD-3-Clause, active Python WebAuthn verifier; candidate if Python is
  retained. The ceremony and credential records remain KV-controlled.
- `django-guardian`: object permissions are relevant, but GitHub did not expose a standard SPDX
  identifier in the repository metadata; license text and compatibility must be checked before use.
- Homarr: Apache-2.0, active, useful UX reference; no code copy in Task 1.

The candidate list is not an approval to add all of these dependencies. The selected path must
match the inspected server runtime, database and existing deployment model.

## 2026-10-04 — Existing dependency security gate

The current frontend build succeeds, but `npm audit` reports a critical DOM sanitizer XSS advisory
for direct `maplibre-gl` versions through 6.4.0. The audit offers 6.12.0 as a major upgrade. The
foundation release must test that upgrade against the map surface, or document and implement a
safe replacement/removal before staging activation.

## 2026-10-04 — Security defaults

Secrets are server-side only. Access is deny-by-default. Administrator status is not a location
override. Location requires explicit consent, purpose, scope and revocation. Audit records contain
security facts and identifiers needed for investigation, never passwords, tokens, API keys or raw
location payloads.

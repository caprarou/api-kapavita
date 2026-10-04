# KV.gr Feature Status

| Area | Status | Evidence / boundary |
|---|---|---|
| Canonical memory and documentation | implemented | Canonical docs are being transferred with the foundation checkpoint. |
| Repository and public endpoint inspection | verified locally | Repository SHA and HTTP responses recorded in Project Memory. |
| Secure staging environment | implemented | Additive `/kv` surface reuses the inspected server, service and Caddy deployment boundary. |
| Product shell/navigation | implemented | Responsive KV shell at `/kv`; existing Spatial Intelligence surface remains at `/`. |
| Authentication foundation | implemented | KV uses existing server-side login/session/CSRF primitives; no browser secrets. |
| Roles and entity-level permissions | implemented foundation | Owner/direct-grant checks are enforced server-side; admin does not bypass entity visibility. |
| 2FA/passkeys/trusted devices | architecture-ready | Extension contract is represented; enrollment and enforcement remain the next hardening task. |
| Sessions/device management | partial existing | Existing sessions are preserved; complete device inventory/revocation remains next. |
| Audit/security logging | implemented foundation | Structured KV security events are written for entity, relationship and layout mutations. |
| Drag-and-drop widget dashboard | implemented foundation | `react-grid-layout` was evaluated and integrated for the KV-specific dashboard layer. |
| Canonical entity model | implemented foundation | People, Companies, Places, Properties/Assets, Vehicles, Accounts, Devices, Documents and relationships. |
| Connector architecture | implemented contract | Connector states, server-secret boundary and consent metadata are exposed as extension points. |
| Dependency security baseline | passed | `maplibre-gl` upgraded to 6.12.0; local build and audit report zero vulnerabilities. |
| Integrations | intentionally deferred | No taxsee, finance, trading, calendar, cameras, Shelly, vehicle or location connector in Task 1. |
| Official GitHub v1 release | deferred | Explicitly outside the first task. |

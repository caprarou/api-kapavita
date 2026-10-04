# KV.gr Connector Contract

Connectors are capability providers, not direct UI integrations. Each connector must declare:

- stable connector ID and version;
- required server-side secrets and their scope;
- capabilities and supported operations;
- source freshness, provenance and error state;
- consent and permission requirements;
- rate limits, retry/backoff and upgrade behavior;
- redaction rules for logs and audit events.

The first foundation task creates extension points only. It does not connect taxsee, financial
accounts, brokers, MT4/MT5, Google Calendar, Reolink, Shelly, official vehicle sources or KV
Companion. A connector may return `unconfigured`, `unauthorized`, `stale`, `error` or `ready`; UI
must not turn any non-ready state into synthetic data.

Family location is a separate consent-sensitive capability. The connector contract must include
subject, purpose, consent version, granted scopes, last-location retention and history window
(`24h`, `7d`, `30d`, custom), with explicit revocation. Admin role alone is insufficient.

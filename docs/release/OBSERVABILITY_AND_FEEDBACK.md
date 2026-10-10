# ReLoop observability, feedback and privacy contract

This document specifies a product/operations baseline. It does not claim a third-party analytics provider or external support inbox is configured.

## Stable workflow event taxonomy

Use stable, versioned event names and a documented schema:

- `listing_started`
- `listing_submitted`
- `listing_validation_failed`
- `offer_submitted`
- `offer_accepted`
- `collection_scheduled`
- `handover_confirmed`
- `support_ticket_created`

Recommended properties: `event_schema_version`, coarse `role`, `locale`, `device_class`, `workflow_version`, and pseudonymous internal identifiers only when needed. Keep event properties allowlisted. Do not send names, email, phone, precise address, uploaded document contents, passwords, session IDs, free-text descriptions or sensitive transaction evidence to product analytics.

## Privacy and consent

- Analytics is not required for core service functionality.
- Choose an analytics provider only after reviewing hosting region, subprocessors, retention, access controls, export/deletion and consent behavior.
- Do not enable session replay by default. If later introduced, mask all inputs and sensitive areas and obtain the required consent.
- Separate product feedback from marketing consent.
- Set retention periods and deletion workflows before production use.

## Operational telemetry

Track API request count, latency percentiles, status-code rates, route template, process memory/CPU, event-loop lag, PostgreSQL pool saturation, query latency, upload failures and background queue depth if a queue is introduced. Include a request/correlation ID. Never log authorization headers, cookies, raw passwords, reset tokens or document bodies.

Alert on user-impacting symptoms first: sustained API failure rate, high p95/p99 latency, failed login spikes, transaction errors, DB pool exhaustion, backup failure, and a rapidly growing support backlog. Every alert needs an owner and runbook.

## Feedback intake

Route each feedback submission into one of: product bug, accessibility/language issue, transaction support, business partnership, or general suggestion. Create a reference ID, owner, priority, status, timestamps and a user-visible response channel. Do not promise a response SLA until staffing supports it. Only expose a reporter's own tickets to that reporter; admin access must be server-authorized and audited.

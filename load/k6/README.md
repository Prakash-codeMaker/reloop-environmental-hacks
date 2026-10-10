# ReLoop staged load testing (k6)

This is a **read-only authenticated workflow test** intended for an isolated staging environment. It logs in as seeded generator, buyer and collector accounts, then requests `/api/auth/me`, `/api/workspace`, `/api/batches`, `/api/notifications`, and buyer matches. It does not create listings, offers, uploads, or handovers.

## Safety requirements

- Only test a staging environment you own or are explicitly authorized to test.
- Use dedicated synthetic test accounts and non-production data.
- The script refuses localhost, plain HTTP, a hostname that does not match `RELOOP_STAGING_HOST_SUFFIX`, missing credentials, or missing `RELOOP_LOAD_TEST_CONFIRM=staging-only`. Set the suffix to a staging-only DNS zone such as `staging.example.com`; do not set it to the parent production domain.
- Do not use production accounts, real personal data, or real customer transactions.
- Confirm with the hosting provider that the test traffic is permitted. Have an operator watching error rate, database connections, CPU/memory, and queue depth.
- Start at a low VU count. Do not jump directly to 10,000 VUs.

## Install k6

Install k6 using the official instructions: https://grafana.com/docs/k6/latest/set-up/install-k6/

## Seed three staging accounts

Create one generator, buyer and collector account through the normal staging signup process. Do not make an admin account for this script. Keep credentials in your shell/CI secret store; do not commit them to the repository.

## Run a low-load baseline first

PowerShell example:

```powershell
$env:RELOOP_BASE_URL = "https://staging.example.com"
$env:RELOOP_LOAD_TEST_CONFIRM = "staging-only"
$env:RELOOP_STAGING_HOST_SUFFIX = "staging.example.com"
$env:RELOOP_GENERATOR_EMAIL = "load-generator@example.test"
$env:RELOOP_GENERATOR_PASSWORD = "<secret-from-your-secret-store>"
$env:RELOOP_BUYER_EMAIL = "load-buyer@example.test"
$env:RELOOP_BUYER_PASSWORD = "<secret-from-your-secret-store>"
$env:RELOOP_COLLECTOR_EMAIL = "load-collector@example.test"
$env:RELOOP_COLLECTOR_PASSWORD = "<secret-from-your-secret-store>"
$env:LOAD_TARGET_VUS = "6"
k6 run load/k6/reloop-readonly.js
```

The profile lasts approximately nine minutes. `LOAD_TARGET_VUS` is split across three role scenarios, with each scenario ramping separately; rounding means planned peak VUs may be slightly above the requested total. Start at 6, inspect results, then try 15, 30, 60 and higher only when metrics remain healthy. Each virtual user repeatedly logs in and reads data, so this workload is intentionally more login-heavy than a typical returning-user session; add a separately designed session-reuse scenario before interpreting it as production traffic.

The script writes `load/results/reloop-readonly-summary.json`. That output directory is generated at runtime and is git-ignored. Compare client-side latency with server logs and database telemetry; client results alone cannot identify the bottleneck.

## Important limitations

- This is not a test of writes, photo uploads, offer contention, transaction idempotency, or 15,000 registered accounts.
- Shared test accounts can make activity less representative of real users.
- The default thresholds are initial guardrails, not measured capacity guarantees. Calibrate them against a known-good staging baseline and product SLOs.
- VUs are not the same as registered users, monthly active users, or HTTP requests per second.

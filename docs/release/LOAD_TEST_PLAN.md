# ReLoop load-test plan

## Test types

1. Smoke: 3–6 virtual users, short duration, verify scripts and telemetry.
2. Baseline: 10–30 VUs, repeat three times and record p50/p95/p99, failure rate and resource use.
3. Ramp: increase in controlled stages; stop when error or saturation guardrails are crossed.
4. Stress: identify the first bottleneck in isolated staging and confirm recovery after load falls.
5. Soak: sustain the expected busy-hour load for 30–120 minutes to reveal leaks and pool exhaustion.
6. Spike: only after baseline, simulate a bounded sudden increase and validate graceful degradation.
7. Write/transaction tests: separately use unique synthetic accounts and records to test listing creation, competing offers, retries/idempotency, evidence uploads and state transitions. Do not reuse the read-only script for write tests.

## Capacity model

Estimate expected peak concurrent sessions from actual observed arrival rate and session duration. Registered user count is not a concurrency input by itself. Track API requests per user journey and background work per transaction. Include headroom and test expected growth, but do not pick a target solely because a round number sounds impressive.

## Run controls

- Written authorization and an isolated staging target are mandatory.
- Use test data and test email addresses; disable real payment/verification side effects.
- Announce the test window, identify the operator and establish stop conditions.
- Stop if p95/p99 exceeds the agreed budget, errors exceed 1%, the database saturates, transaction consistency is affected, or any unrelated service is impacted.
- Capture client metrics plus app/database/host metrics; annotate build, database size, test profile and configuration.
- After the test, inspect correctness, not only performance; reconcile record counts and confirm no unintended writes.

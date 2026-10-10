# ReLoop release readiness and staged beta plan

Status: **planning template; not evidence of completed release validation.**

## 1. Gates before inviting external users

### Product and workflow
- [ ] Generator can register, sign in, create and edit a listing, and understand its current status.
- [ ] Buyer can search, inspect, submit an offer, and understand whether the server accepted it.
- [ ] Generator can accept/reject an offer and see the persisted result.
- [ ] Admin can assign a collector with server-enforced permissions.
- [ ] Collector can record collection, actual accepted weight, and required evidence before completion.
- [ ] Issue/reporting flow creates a reference, shows current status, and routes to an owned admin queue.
- [ ] Every retry/refresh/network-loss case has a documented expected outcome.

### Localization and accessibility
- [ ] Audit every visible and assistive-technology string in all seven supported languages.
- [ ] Native-speaker review of business, verification, safety and legal text.
- [ ] Playwright localization and role journeys pass.
- [ ] axe checks have no unresolved critical/serious violations; manually test keyboard, focus, zoom and screen reader behavior.
- [ ] Test at 320–360 CSS px and with long translated labels, error messages and dialogs.
- [ ] Verify `lang`, locale-sensitive dates/numbers, language persistence and text direction where relevant.

### Security and privacy
- [ ] Review against the current stable OWASP ASVS version and record exceptions.
- [ ] Verify object-level authorization on every batch, offer, evidence, issue and admin endpoint.
- [ ] Check session cookie flags, CSRF protections for cookie-authenticated state-changing requests, rate limits, input bounds and upload validation.
- [ ] Run dependency and secret scans; rotate any credentials that may have been exposed.
- [ ] Confirm privacy notice, purpose limitation, retention/deletion and incident contact.
- [ ] Verify backups can be restored in a clean environment and document RPO/RTO.

### Operations and deploy
- [ ] Successful clean `npm ci`, quality suite, production build and E2E suite in CI.
- [ ] Staging mirrors production Node version, database type, proxy, TLS and environment variables.
- [ ] Health/readiness checks, structured logs, request IDs and alerts are configured.
- [ ] Database migration is tested against a copy and has a rollback/forward-fix plan.
- [ ] Release artifact is immutable and versioned; rollback and feature-disable steps are rehearsed.
- [ ] A named operator is available during each cohort expansion.

## 2. Cohort rollout (suggested, not universal)

| Cohort | Purpose | Exit gate |
|---|---|---|
| Internal / 5–10 | Validate the release process and test accounts | No critical defects; all smoke tests pass |
| 20–40 moderated users | Observe task comprehension and accessibility barriers | Critical usability issues fixed; task results recorded by role/language/device |
| 100–300 closed beta | Validate real workflow completion and support operations | Stable transaction integrity; support can respond; no unresolved critical security issue |
| 500–1,000 | Validate marketplace liquidity and operational throughput | Supply-demand and support metrics healthy in the pilot geography |
| 3,000 | Controlled public beta | Capacity, reliability and product metrics stay within agreed thresholds |
| 10,000–15,000 | Broader beta | Ramp only after observed traffic and load tests support the next level |

Registered users are not concurrent users. Define expected concurrency from observed usage and test that traffic shape separately.

## 3. Proposed initial service objectives (validate before adoption)

- Core Web Vitals at the 75th percentile: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1.
- API availability: propose 99.5% monthly for critical endpoints as a starting point, subject to product needs and monitoring capability.
- Load test: p95 < 1,000 ms and request failure rate < 1% as initial staging guardrails. Establish a baseline first; tune thresholds to endpoint-specific behavior.
- Critical transactions: zero duplicate completion, cross-account access or false-success results in acceptance tests.
- Translation: 100% of required core UI strings reviewed in all supported languages before claiming full support.

These are targets, not current ReLoop measurements.

## 4. Beta success metrics

Track per role, language, device and geography where sample size allows:
- listing-start to valid-listing completion rate and median time-on-task;
- listings receiving at least one relevant offer, time to first offer and offer acceptance;
- scheduled pickups completed, cancelled and disputed;
- failed requests, retries, duplicate actions and false-success reports;
- ticket first-response and resolution time, reopen rate, issue categories;
- language switching success, unresolved localization issues, accessibility task blockers;
- returning active businesses and repeat completed transactions.

Avoid optimizing time alone: faster but inaccurate material/weight details are a negative outcome. Do not put emails, phone numbers, addresses, free text or authentication data in analytics event properties.

## 5. Incident / pause rules

Pause cohort expansion if any critical authorization/data leak is suspected, transaction state becomes inconsistent, false confirmations occur, error rates exceed the agreed threshold for the agreed window, backups fail, or support queues exceed the team's ability to respond. Record incident timeline, affected workflow, mitigation, user communication, and follow-up action.

## 6. Required artifacts for final approval

- Build and test run IDs/logs from CI.
- E2E and accessibility findings plus remediation notes.
- Native-language review sign-off.
- Load-test report and matching server/database telemetry.
- Security review and open-risk register.
- Backup restore and rollback evidence.
- Named release owner, support owner and escalation contacts.

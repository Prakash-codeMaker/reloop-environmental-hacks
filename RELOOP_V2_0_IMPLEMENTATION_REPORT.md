# ReLoop v2.0.0 — pre-launch readiness toolkit

## Delivered in this version

- Added a staged beta / release readiness checklist covering product workflows, localization, accessibility, security, operations, rollback, and cohort expansion through 10,000–15,000 participants.
- Added a load-testing plan covering smoke, baseline, ramp, stress, soak, spike and separate transaction-write tests.
- Added a k6 authenticated read-only workflow script for generator, buyer and collector roles. It requires explicit staging confirmation, HTTPS, a matching staging-host suffix and dedicated synthetic test accounts. It never creates listings, offers or handovers.
- Added privacy-conscious observability/event taxonomy and support feedback routing specifications. No analytics provider or external support service is represented as configured.
- Added staging test-data and security handling guidance.
- Updated Playwright to launch the API and Vite together on dedicated ports and a temporary data directory; updated the Vite proxy to honor an environment target.
- Added automated tests for release-tooling docs and the load-test safety guard.

## Verification performed in this environment

- `node --test test-api.mjs test-workflow.mjs test-release-tooling.mjs`: **34 passed, 0 failed**.
- `npm run i18n:check`: passed; 271 audited literal keys have dictionary entries in all seven locales. 22 dynamic expressions still require manual review.
- `npm run i18n:surface`: completed; generated heuristic inventory still lists 118 potential hardcoded-text candidates.
- `node --check playwright.config.js`: passed.
- `node --check scripts/dev.mjs`: passed.
- `node --check load/k6/reloop-readonly.js`: passed.
- ZIP integrity: checked after packaging.

## Not verified / limitations

- `npm run build` could not run because Vite is not installed in the environment (`vite: not found`). Dependency installation was not completed here.
- Playwright/axe browser tests were not executed in this environment.
- k6 has not been run against a deployed staging environment; no capacity or concurrency claim is made.
- The current PostgreSQL compatibility layer still loads datasets into memory and serializes writes. This is a known scale boundary that must be addressed before claiming high-throughput multi-instance readiness.
- Evidence storage remains local-disk based in the included single-server deployment; private object storage and upload scanning are still needed before multi-instance public launch.
- No third-party analytics provider, support inbox, hosting account, or staging domain is configured by this archive.

## Next execution steps

1. Run `npm install` on a network-enabled machine.
2. Run `npm run test:quality`, `npm run build`, and `npx playwright install chromium && npm run test:e2e`.
3. Deploy to isolated HTTPS staging and configure synthetic generator/buyer/collector accounts.
4. Follow `load/k6/README.md`, beginning at 6 VUs and inspecting both k6 and server/database telemetry before ramping.
5. Close the release checklist and record evidence before inviting the next cohort.

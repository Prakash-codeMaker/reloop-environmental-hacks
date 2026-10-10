# ReLoop — full-stack material coordination workspace

ReLoop coordinates commercial recyclable-material listings, buyer offers, collection assignments and recorded handovers. This package now includes the existing role-based React UI plus a dependency-light Node.js API for shared server-side data.

## What works in the shared workspace

- Business accounts can register and sign in. Passwords are hashed with Node's `scrypt`; sessions use signed, HTTP-only cookies.
- Business role is selected at registration: material generator, buyer/recycler, or collector/logistics. Admin cannot be selected through public registration.
- Listings are stored server-side and can be seen by other authorized participants on the same running instance.
- Buyers can request rules-based material matches and submit offers; the listing owner can accept or decline an offer.
- An accepted offer can be assigned to a registered collector by an administrator.
- Assigned collectors can mark a pickup collected, upload JPG/PNG/PDF handover evidence, and complete the record with a positive actual weight.
- In-app notifications are persisted and refreshed in the workspace. Optional transactional email notifications can be enabled with Resend.
- Role-specific verification is visible in each generator, buyer and collector workspace: email contact, organization/identity review, and a role-specific evidence check. Document types are constrained by role, and server responses expose each check state.
- Administrators can review partner accounts, set manual verification status, assign collectors, and inspect server-generated audit records.
- Optional Razorpay order/signature endpoints are included but intentionally disabled unless merchant credentials and a server-configured platform fee are supplied.
- Demo mode remains available separately. Demo records and live workspace records are clearly distinguished.

## AWS integration plan

The current backend can store handover and business-verification evidence in a private S3 bucket when `RELOOP_S3_BUCKET` is configured. See [`infra/aws/RELOOP_AWS_ARCHITECTURE.md`](infra/aws/RELOOP_AWS_ARCHITECTURE.md) for the recommended AWS design, user benefits, deployment stages, cost controls and visibility limitations. The AWS resources are not deployed by this ZIP; verify the production build, configure an authorized AWS account, and test the full workflow before describing ReLoop as live on AWS.

## No-AWS-account hackathon path: OpenSearch Build It

The Environmental Hacks event page lists OpenSearch among the AWS open-source tools that can be used locally without an AWS account. ReLoop's buyer matching endpoint can use a local OpenSearch service for full-text/fuzzy material discovery. This is **not** Amazon OpenSearch Service or an AWS cloud deployment; the local service must be running and shown in the demo for this path to be evidenced.

See [`OPENSEARCH_BUILD_IT_GUIDE.md`](OPENSEARCH_BUILD_IT_GUIDE.md) for exact setup, verification and security boundaries. In brief, start `docker-compose.opensearch-demo.yml`, set `RELOOP_OPENSEARCH_URL=http://localhost:9200`, start ReLoop, perform a buyer search, and confirm `/api/matches` reports `searchEngine: "OpenSearch"`. If OpenSearch is unavailable, ReLoop falls back to built-in search.

## Requirements

- Node.js 22 LTS recommended (Node 20.19+ may work with the current Vite release).
- npm.
- Internet access for the first `npm install` so Vite, React and UI dependencies can be downloaded.

## Run on Windows

1. Extract the ZIP.
2. Double-click `RUN_ON_WINDOWS.bat`.
3. Wait for the dependency install and both servers to start.
4. Open the Vite URL printed in the terminal, normally `http://localhost:5173`.
5. Choose **Demo · Switch to live** in the top bar to create or sign into a shared workspace.

Manual start:

```powershell
npm install
npm run dev
```

The development script runs the API on `http://localhost:3001` and Vite on `http://localhost:5173`. Vite proxies `/api` calls to the API.

## First administrator account

Admin accounts cannot self-register. For local testing, copy `.env.example` to `.env`, then set a unique admin email and password:

```dotenv
RELOOP_ADMIN_EMAIL=admin@yourcompany.example
RELOOP_ADMIN_PASSWORD=use-a-long-unique-password
RELOOP_ADMIN_NAME=ReLoop Operations
RELOOP_SESSION_SECRET=use-a-long-random-secret
```

Restart the API after changing `.env`. The first configured admin is created on server startup. Do not use the example values in a public deployment. If a configured admin already exists in the data store, changing these variables does not reset its password.

## API and test commands

```powershell
# API-only process
npm run server

# Run API integration tests (no extra test framework required)
npm run test:api

# Build the production frontend
npm run build

# Serve the built frontend and API together
npm start
```

Health check: `GET /api/health`.

The integration tests exercise account registration, admin-role protection, listing creation, matching, offer acceptance, collector assignment, evidence-required completion, partner verification and audit permissions.

## Role-specific verification

The Verification page is available in the generator, buyer and collector navigation. It shows three separate checks: contact email, organization/identity evidence, and role-specific evidence. The document choices differ by role and the API rejects document categories that do not apply to that role. Uploaded files move the relevant check to review; uploads never self-verify an account. Admin approval remains a human review decision and requires at least one document relevant to the account role. The signed external KYB webhook can update the overall status when a real provider is configured. No SMS/phone OTP or provider-specific identity lookup is included until a service is selected and configured. Demo statuses are illustrative and do not verify real participants.

## Email verification and notifications

Configure Resend with a verified sender and set `RESEND_API_KEY` and `RELOOP_FROM_EMAIL`. In production, email verification is mandatory: registration sends a 24-hour single-use link, and unverified accounts cannot sign in. Password recovery uses a one-hour single-use token and invalidates old sessions after a successful reset. Delivery still depends on the configured provider and domain records.

## Payments: intentionally gated

Razorpay order creation requires server-side API credentials, a configured platform fee and a completed transaction that the signed-in user participated in. The `/api/payments/webhook` endpoint validates the raw-body Razorpay signature and handles duplicate event IDs idempotently. A browser signature is not treated as settlement; the captured event is recorded only after the provider's signed webhook is validated.

This does **not** implement escrow, seller payouts, refunds, chargebacks, tax invoices or a full settlement ledger. Keep payment credentials absent until the fee policy, provider account, legal/accounting requirements and webhook operations are approved. Never put payment secrets in frontend code.

## Data, storage and production boundary

- Local development can use `server/data/reloop.json` and `server/data/uploads/`. When `DATABASE_URL` is set, the API uses PostgreSQL tables for users, batches, offers, notifications, audit entries, payment records and one-time/webhook tokens. Existing JSON data is imported automatically on startup only if the PostgreSQL user table is empty, or can be imported explicitly with `node scripts/migrate-json-to-postgres.mjs`.
- PostgreSQL entity payloads are JSONB with indexed identity/status columns. The current compatibility layer still loads the dataset into memory and serializes writes, so this is suitable for a controlled pilot, not high-throughput multi-instance service. Replace it with query-level repository methods before scaling.
- Evidence files remain on private local disk in the included single-server deployment and are persisted in a Docker volume. Before multi-instance use, move them to private object storage with signed access, malware scanning and retention controls.
- Manual business review is available. A signed external-verification webhook adapter is included, but the actual provider's account, API/session creation and vendor-specific callback mapping must be configured separately; a webhook signature does not independently establish legal identity.
- Matching is a transparent rules-based filter. Location relevance is based on text terms, not geocoded road distance or transport cost. It does not promise live availability or optimal matches.
- Browser push and SMS are not included. In-app notifications are persisted; email delivery depends on provider configuration.
- For deployment, use `docker compose` with Caddy HTTPS, set secrets in `.env`, configure off-server backups and monitoring, review privacy/retention, and complete an independent security review. See `PRODUCTION_DEPLOYMENT.md`.

## Deployment files

- `Dockerfile` — multi-stage frontend build and Node runtime.
- `docker-compose.yml` + `Caddyfile` — PostgreSQL, app, automatic HTTPS and private networking.
- `scripts/backup.sh` / `scripts/restore-backup.sh` — database and upload backup/restore.
- `scripts/migrate-json-to-postgres.mjs` — guarded one-time JSON import.
- `PRODUCTION_DEPLOYMENT.md` — environment, DNS, email, KYB, payments, backup and operational runbook.

## Stack

- React + Vite + Lucide React
- Custom responsive CSS design system
- Node.js built-in HTTP/crypto APIs plus the `pg` PostgreSQL driver

## Production hardening bundle

See [`PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md) for the Docker/Caddy HTTPS deployment, PostgreSQL persistence, email verification, password recovery, signed KYB and Razorpay webhook contracts, and backup/restore runbook. `.env.example` now documents the required configuration. Production startup intentionally fails closed if its core secrets, PostgreSQL, HTTPS URL, email provider, bootstrap administrator, or KYB callback secret are missing.

**Scale boundary:** the current PostgreSQL compatibility layer stores entity payloads in separate indexed tables but still loads them into memory and serializes writes. This is a controlled-pilot foundation, not a high-throughput production repository. A real provider-specific KYB API integration and seller payout/escrow workflow require separate implementation and credentials; neither is falsely represented as live.


## Low-friction workflow improvements (v1.3)

- Generator listing forms remember the last used material, unit, condition, location and optional details per local demo workspace or signed-in account. Use **Use as template** on a batch to create a new listing from its details without copying its old status, price, or collection date.
- Buyer offers use a simple collection-preference choice and an optional note instead of overloading the note field with scheduling details.
- Demo offers are now persisted in browser-local demo state and appear in the generator's Offers view when switching roles. The UI clearly says these offers are local demo records and are not sent to real businesses.
- Collectors get a direct **Mark collected** action from the assigned-pickup list. It then opens the handover record so the collector can enter actual weight and confirm evidence. The final completion still requires the appropriate handover evidence in live mode.
- Material categories are mapped correctly for rigid plastic as well as paper, PET and cardboard; displayed weights and offer units follow the batch unit.
- The workflow intentionally does not auto-assign a real collector or claim an offer is live. Real assignments, external verification and shared transaction data require the authenticated API.

## Authentication and role separation (v1.4)

Live sign-in asks you to select the role for the account. The API checks that selection against the account's server-stored role. A mismatch does not create a session. Registration supports Material generator, Buyer / recycler, and Collector / logistics; administrator accounts must be provisioned by an administrator and cannot self-register.

If you try to register an email address that already has an account, ReLoop returns you to Sign in with a clear message. Use the existing password or the Forgot password flow instead of registering the same address again.

Role switching in the demo is a preview feature only. Live accounts do not get the demo role switcher. Demo data is stored under separate versioned browser-storage keys; returning from a live workspace reloads the demo snapshot instead of copying live workspace data into the demo.

See `AUTH_AND_ROLE_ISOLATION_FIXES.md` for details. Run `npm test` to test login role enforcement, duplicate registration handling, transaction permissions, and the UI workflow checks.


## Language, accessibility and issue reporting (v1.6)

- Language picker supports English, Hindi, Marathi, Gujarati, Tamil, Telugu and Kannada. The browser language is used only as an initial suggestion; users can choose another language. The preference is saved locally and, for authenticated users, can be stored on their ReLoop account through `PATCH /api/profile/language`.
- The first localization pass translates key navigation, common task labels, selected listing fields and core actions. It is **not yet a full professional translation of every screen**. Have native speakers review all commercial, verification, safety and legal copy before a public launch.
- The quick-guide button uses the browser's Web Speech API. Actual voice availability and pronunciation depend on installed browser/device voices; the app does not guarantee speech support on every device.
- All three operational roles have a Report an issue page. Live reports are stored server-side, are visible to the reporter and authorized admins, and can be moved through open, in-review, resolved and closed states. Reports are also written to the audit log and notify configured admin accounts.
- An installable PWA manifest and service worker cache the app shell and static assets. API requests are deliberately never cached. This is **not full offline operation**: users must reconnect before submitting listings, offers, reports or status changes.
- Language selection does not infer caste, religion, gender or social identity. No such attributes are used for matching or ranking.

## New tests

`npm test` now includes API tests for role-scoped issue reports, administrator issue management, validation and account-persisted language preferences, plus static checks for the language picker and PWA shell.

## Localization and accessibility — v1.9.0

This version adds broader reviewed first-pass translations for seven interface languages, locale-aware dates in verification/issue/audit views, localized common action feedback, and a strict audit covering 271 known literal and dynamic UI keys. Run `npm run test:quality` to execute the API/workflow tests and localization audit.

**Important:** the UI-text inventory still contains 118 heuristic candidates and does not prove full translation coverage. Browser E2E/axe tests are present but have not been executed in the current build environment; native-speaker review and a successful production build are still required. See `RELOOP_V1_9_IMPLEMENTATION_REPORT.md` and `LOCALIZATION_AND_ACCESSIBILITY_AUDIT.md`.

## Localization and accessibility quality gates (v1.7.0)

- `npm run i18n:audit` prints current translation-key coverage and flags dynamic expressions for manual review.
- `npm run i18n:check` fails if a literal translation key used through `tr()` is missing from a supported locale.
- `npm test` includes translation-key coverage and accessibility shell checks.
- The interface now includes a keyboard-visible skip link, active navigation state, polite toast announcements, reduced-motion handling, cross-tab language synchronization, and development warnings for missing translation lookups.

See [`LOCALIZATION_AND_ACCESSIBILITY_AUDIT.md`](./LOCALIZATION_AND_ACCESSIBILITY_AUDIT.md) for scope and limitations. Key coverage is not the same as complete translation or native-speaker approval.

## v1.8.0 localization and accessibility quality gates

- Run `npm run i18n:check` to verify literal translation-key coverage, including page-heading props.
- Run `npm run i18n:surface` to regenerate the heuristic hardcoded UI-text inventory in `LOCALIZATION_UI_TEXT_AUDIT.md` and `.json`.
- Run `npm run test:e2e` after installing Playwright browsers to test locale persistence, skip-link behavior, mobile UI and axe-core accessibility checks.
- See `RELOOP_V1_8_IMPLEMENTATION_REPORT.md` for exact verification status and known limitations.

## Pre-launch readiness and staged beta (v2.0 planning toolkit)

This package adds a release-readiness checklist, privacy-conscious observability and feedback contract, staging-data/security controls, and a guarded k6 read-only load-test script. These are implementation tools and planning gates; their presence does **not** mean staging, browser E2E, production build, security review, or load testing has already passed.

- [`docs/release/RELEASE_READINESS.md`](./docs/release/RELEASE_READINESS.md) — pre-launch gates, suggested cohort progression, candidate SLOs and release evidence.
- [`docs/release/LOAD_TEST_PLAN.md`](./docs/release/LOAD_TEST_PLAN.md) — smoke, baseline, ramp, stress, soak and transaction test strategy.
- [`docs/release/OBSERVABILITY_AND_FEEDBACK.md`](./docs/release/OBSERVABILITY_AND_FEEDBACK.md) — stable event taxonomy, privacy rules, telemetry and feedback routing requirements.
- [`docs/release/TEST_DATA_AND_SECURITY.md`](./docs/release/TEST_DATA_AND_SECURITY.md) — synthetic data, secrets, integration sandbox and staging security requirements.
- [`load/k6/README.md`](./load/k6/README.md) — how to run the read-only authenticated staging load test safely.

### Quality and release checks

```bash
npm install
npm run test:quality
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright now launches the API and Vite app on dedicated test ports and uses a temporary data directory. The k6 script requires an HTTPS staging URL, three dedicated synthetic role accounts and the explicit `RELOOP_LOAD_TEST_CONFIRM=staging-only` safety flag. Start at 6 virtual users and ramp only after reviewing client and server/database telemetry. Never point stress tests at production without written authorization and a controlled test plan.

**Known scale boundary:** the current PostgreSQL compatibility layer still loads datasets into memory and serializes writes, and evidence storage is local-disk based in the included single-server deployment. Before claiming high-throughput or multi-instance readiness, replace that compatibility layer with query-level repository methods, move evidence to private object storage, add database/queue/host telemetry, and prove capacity in a representative staging environment.


## Environmental Hacks 2026 — Waste and Energy submission pack

This project is being prepared for the Environmental Hacks track on waste and recycling. Read `HACKATHON_SUBMISSION_WRITEUP.md`, `DEMO_VIDEO_SCRIPT_UNDER_3_MINUTES.md`, and `FINAL_HACKATHON_SUBMISSION_CHECKLIST.md` before submission. The official event requires a public repository, a YouTube demo under three minutes, a short write-up, and genuine AWS use shown in the video. The published deadline is October 11, 2026 at 8:00 PM IST; verify the live submission page.

### Optional AWS S3 evidence storage

The backend can store handover and verification evidence in a private S3 bucket using AWS SDK for JavaScript v3. Local disk remains the default when `RELOOP_S3_BUCKET` is empty. Review `infra/aws/README.md` and deploy `infra/aws/evidence-bucket.yaml` in a sandbox before recording a demo. This template only creates the bucket; it does not deploy the application. Do not claim AWS deployment until the live upload/retrieval path has been verified.

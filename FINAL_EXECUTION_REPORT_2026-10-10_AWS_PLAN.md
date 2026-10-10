# ReLoop AWS integration planning update — 10 October 2026

## Decision

Adopt AWS incrementally around the existing React/Vite + Node.js architecture. Do not rewrite the app into microservices before traffic demonstrates a need.

## What changed in this package

- Added `infra/aws/RELOOP_AWS_ARCHITECTURE.md` with service choices, user benefits, staged deployment, cost controls, security requirements, public discoverability caveats, and the current implementation boundary.
- Linked the architecture guide from the main README and AWS evidence README.
- Updated the package version to 2.1.2.
- Existing private S3 storage remains optional; local development remains possible without AWS credentials.

## Recommended architecture

- AWS Amplify Hosting: React/Vite frontend, HTTPS and CDN-backed static asset delivery.
- AWS App Runner: run the existing Node API without rewriting the backend.
- Private Amazon S3: evidence storage, with backend authorization retained.
- Amazon RDS for PostgreSQL: shared durable application data before a real multi-instance production rollout.
- Amazon CloudWatch: logs, errors, latency and alarms.
- Route 53/ACM: optional custom domain and TLS after the staging deployment works.

## Verification performed

- `node --test test-api.mjs test-workflow.mjs test-release-tooling.mjs`: 36 passed, 0 failed.
- `npm run i18n:check`: passed for 271 literal keys across seven locale dictionaries; 22 dynamic expressions still require manual review.
- `node --check server/server.mjs`: passed.

## Not performed / blockers

- No AWS resources were created because no authorized AWS credentials/account were available.
- No S3 upload/download was tested against a live bucket.
- No Amplify, App Runner, RDS or CloudWatch deployment was performed.
- No production build was verified because dependency installation previously timed out and Vite was not installed.
- No production traffic, SEO ranking, accessibility conformance, or waste-diversion impact is claimed.

## Key implementation limitation

The current API streams evidence through Node.js and then stores it in S3 when configured. This preserves centralized authorization and is suitable for an initial pilot, but API bandwidth and memory use grow with file traffic. Presigned direct-to-S3 uploads are documented as a future optimization; they are not yet implemented. Implement and test them only after the current AWS path is deployed and its authorization checks are verified.

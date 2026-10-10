# ReLoop hackathon submission status — 10 October 2026 (execution update)

## Prepared in this package

- Project positioned for the Environmental Hacks **Waste and Energy** track.
- Submission write-up: `HACKATHON_SUBMISSION_WRITEUP.md`.
- Under-three-minute demo script: `DEMO_VIDEO_SCRIPT_UNDER_3_MINUTES.md`.
- Rules/judge alignment: `HACKATHON_RULES_AND_JUDGE_ALIGNMENT.md`.
- Final compliance checklist: `FINAL_HACKATHON_SUBMISSION_CHECKLIST.md`.
- Optional AWS S3 evidence-storage adapter using `@aws-sdk/client-s3` (not deployed).
- Optional OpenSearch open-source discovery adapter for buyer material search; local run instructions in `OPENSEARCH_BUILD_IT_GUIDE.md`.
- AWS architecture and phased deployment guide: `infra/aws/RELOOP_AWS_ARCHITECTURE.md` (Amplify frontend, App Runner API, private S3 evidence, PostgreSQL/RDS, CloudWatch, SEO and cost guardrails).
- Private S3 bucket CloudFormation template and least-privilege policy template in `infra/aws/`.
- README updated with setup and limitations.

## Verification actually performed

- `node --test test-api.mjs test-workflow.mjs test-release-tooling.mjs`: **36 passed, 0 failed** (re-run in this execution).
- `node --check server/server.mjs`: passed.
- `node --check test-release-tooling.mjs`: passed.
- `npm run i18n:check`: passed; 271 literal keys found in all seven dictionaries (re-run in this execution).
- `node --check server/server.mjs` and `node --check test-release-tooling.mjs`: passed.
- `npm install --no-audit --no-fund`: attempted for 120 seconds and timed out; no dependency-complete build was possible.
- AWS CLI is not installed in this environment; no AWS account credentials are available here.
- The connected GitHub account has no ReLoop repository in the first 51 accessible repositories, and the available GitHub actions do not expose repository creation.
- No `.git` history is included in the ZIP; do not fabricate or backdate commit history.

## Not yet verified / still required

- `npm run build` currently fails in this environment because Vite is not installed (`sh: 1: vite: not found`). An `npm install --prefer-offline --no-audit --no-fund` attempt timed out in this environment. Dependency installation needs to succeed on a machine with npm registry access.
- Playwright/axe browser tests have not been executed.
- The S3 CloudFormation stack has not been deployed, and S3 upload/retrieval has not been tested with AWS credentials/IAM. Do not claim a live AWS deployment.
- The OpenSearch code path has not been runtime-tested against an OpenSearch server because Docker is unavailable in this environment. It is optional and falls back to built-in search if unavailable.
- A public GitHub repository URL has not been created or supplied in this workspace.
- The YouTube demo has not been recorded or uploaded.
- The submission form has not been completed.
- Confirm the earliest project work began after the event opened on 8 October 2026. Official rules disqualify projects that predate the event, even if rewritten. Do not submit if that condition is not met; ask the organisers if unsure.
- UI localization remains incomplete. Key coverage is not proof of full translation or WCAG conformance.
- Current persistence layer loads datasets into memory and serializes writes; this prototype must not be represented as production-scale/high-throughput.

## Time-critical next steps

1. Confirm event eligibility and team/student requirements.
2. Install dependencies, run `npm run test:quality`, `npm run build`, install Chromium and run `npm run test:e2e`.
3. For the no-cloud Build It route, start the local OpenSearch service using `docker-compose.opensearch-demo.yml`, set `RELOOP_OPENSEARCH_URL`, and verify the buyer search plus the OpenSearch index query. This path must be shown in the demo. For the deployed route, deploy `infra/aws/evidence-bucket.yaml` with least-privilege IAM and verify a synthetic upload/retrieval; this cannot be completed here without account access.
4. Record the demo following the script; keep it under 3 minutes; test the YouTube link signed out.
5. Create a public GitHub repository in your account, then push the actual project with authentic history and all attribution/licence information. Repository creation is not available through the connected GitHub actions in this session; do not use a misleading one-commit history if the rules require authentic event-period history.
6. Submit the repository, video and write-up through the official form before the published deadline, Sunday 11 October 2026, 8:00 PM IST. Re-check the live form for any changes.

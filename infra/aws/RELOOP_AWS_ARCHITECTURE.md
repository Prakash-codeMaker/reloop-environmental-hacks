# ReLoop AWS architecture: useful services, in rollout order

## The goal

AWS should improve ReLoop's real user experience: the page opens reliably on mobile networks, generators can list materials without friction, buyers can discover and offer on batches, collectors can complete handovers, and proof documents remain private and durable. AWS is infrastructure, not a substitute for actual users, search visibility, or good UX.

## Recommended architecture

```text
Phone / desktop browser
  ├── AWS Amplify Hosting (React + Vite static build, HTTPS, CDN-backed delivery)
  └── HTTPS API ── AWS App Runner (existing Node.js API)
                       ├── Amazon RDS for PostgreSQL (durable transactional records)
                       └── Private Amazon S3 bucket (handover + verification evidence)
```

Use this as a staged target, not a claim that it is already deployed. Keep the existing React/Vite app and Node API. Avoid a premature rewrite into dozens of Lambda functions or microservices.

## What each service genuinely adds

| Service | ReLoop use | User-visible benefit | When to enable |
|---|---|---|---|
| AWS Amplify Hosting | Build and host the Vite frontend over HTTPS with managed CDN delivery | Faster/reliable app shell delivery across locations; simple redeploys | First, once the production build succeeds |
| AWS App Runner | Run the current Node API as a managed web service | Managed HTTPS endpoint and easier service scaling than a hand-managed VM | Alongside a real staging deployment |
| Amazon S3 | Private storage for pickup photos, signed handover documents and partner-verification files | Evidence is not tied to one server's local disk; files can survive app restarts/redeploys | First AWS-backed workflow |
| Amazon RDS for PostgreSQL | Persist accounts, listings, offers, assignments and audit records | Durable multi-user records and safer concurrent transactions than local JSON | Before real users; the app must be tested with `DATABASE_URL` first |
| CloudWatch | API logs, request errors, latency and alarms | Faster diagnosis when listing, offer or upload actions fail | With staging/prod rollout |
| Route 53 + ACM (optional) | Custom domain and TLS | Trustworthy branded URL and HTTPS | After the core app is stable |

AWS sources: [serverless web-app architecture](https://docs.aws.amazon.com/whitepapers/latest/serverless-multi-tier-architectures-api-gateway-lambda/web-application.html), [Amplify/static site hosting recommendation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html), [private S3 origins and CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## What AWS will not automatically solve

- **Search visibility:** hosting does not automatically rank ReLoop in Google. Public pages need meaningful page titles/descriptions, crawlable public material listings, a sitemap/robots policy, canonical URLs and real useful content. Do not expose private partner details or private transaction pages to search engines.
- **Low-friction data entry:** keep role-specific forms short, show only the fields needed for the current step, validate on the client and server, provide save/error feedback, and preserve keyboard/screen-reader support. CDN hosting helps delivery, not confusing forms.
- **Market liquidity:** AWS cannot create buyers, collectors or material supply. Track real activation and completed pickups before claiming impact.
- **Production readiness:** the current app still needs a successful install/build, live Postgres testing, browser/accessibility checks and an authorized deployment before production claims.

## Evidence-storage design (implemented in the current API)

The API already supports local file storage for development and private S3 storage when `RELOOP_S3_BUCKET` is set. It generates a random object key under `private/handover/` or `private/verification/`, validates supported file types/signatures, and authorizes a participant/admin before returning the file. S3 uses server-side encryption and the bucket template blocks public access. The API currently streams file bytes through Node; this is simpler and keeps authorization centralized, but it consumes API bandwidth and memory per upload/download.

**Scale-up option:** introduce a short-lived S3 presigned-upload flow after staging tests. The API should authenticate the user, authorize the batch/verification action, issue a URL scoped to one random object key and short expiry, and only then record metadata after the upload is verified. Never expose AWS credentials in the browser or make the evidence bucket public. AWS explains presigned URL constraints and risks here: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html. Do not switch to direct uploads until expiry, content-type/size checks, object ownership and abandoned-upload cleanup are tested.

## Deployment sequence

### Stage 0 — local release gate

1. Run `npm ci` (or `npm install` if no lockfile exists) and `npm run build`.
2. Run `npm run test:quality` and `npm run test:e2e` after Playwright browsers are installed.
3. Confirm the app uses PostgreSQL for any shared/staging environment. Do not use JSON-file persistence for multi-instance production.
4. Review `PRODUCTION_DEPLOYMENT.md`, `.env.example`, cookie/CORS settings and session-secret requirements.

### Stage 1 — evidence bucket

1. Use a dedicated AWS sandbox account and choose `ap-south-1` unless latency/compliance requirements justify another region.
2. Deploy `evidence-bucket.yaml` with CloudFormation and review the change set/outputs before confirming.
3. Attach `evidence-access-policy.template.json` to the backend's **IAM role** (not an access key committed to the repo), replacing the bucket placeholder. Keep access limited to `private/*`.
4. Set `RELOOP_S3_BUCKET` and `AWS_REGION` on the backend service. Test upload and authorized download, then test that a different user cannot download the file.
5. Use synthetic documents only until retention, deletion and privacy processes are defined.

### Stage 2 — staging app

1. Deploy the frontend to Amplify Hosting from the repository; configure the correct Vite API base URL if needed and verify SPA route fallback.
2. Deploy the existing Node API to App Runner from a container image or supported source configuration. Set production environment variables in the service configuration, not source control.
3. Set `APP_BASE_URL` to the actual HTTPS frontend URL and `RELOOP_ALLOWED_ORIGINS` to the exact allowed origin(s), no wildcard with credentialed sessions.
4. Configure `DATABASE_URL` to a TLS-enabled PostgreSQL database. For production, prefer RDS in private networking and enable backups; don't use local JSON storage across instances.
5. Give App Runner a narrowly scoped IAM instance role for S3 access. Do not create long-lived IAM user keys for the app.
6. Test generator listing → buyer offer → generator acceptance → collector pickup → evidence upload → authorized evidence download → admin review. Test a forbidden cross-account download.
7. Check CloudWatch logs/alarms, request latency, API errors and cost/budget alerts before inviting pilot users.

### Stage 3 — public pilot and discoverability

- Add a custom domain and managed TLS certificate once the service is stable.
- Add page titles/descriptions, Open Graph tags, sitemap and robots policy for only genuinely public pages. Private dashboards and partner data must not be indexable.
- Measure page load on a low-end phone/mobile network, registration completion, listing completion, buyer-offer conversion, pickup completion, upload failures and real material diverted. Publish measured numbers only.
- Consider presigned direct-to-S3 upload if evidence volume causes API bandwidth/latency issues. Consider caching/read replicas only after metrics identify a bottleneck.

## Cost and safety guardrails

- Set an AWS Budget alert before deploying; check current service pricing in the selected region. Costs can occur even when a demo is idle, especially for databases, NAT gateways, logs and always-on compute.
- For a short demo, use the smallest viable configuration and synthetic data; shut down or delete unused resources after the event.
- Keep S3 private, block public access, enforce TLS, encrypt at rest, scope IAM to the required bucket/prefix, and never store AWS credentials in the repo.
- Use CloudWatch logs with care: do not log passwords, session cookies, document contents or presigned URLs.
- Do not claim an AWS service is integrated until a deployed, authorized test proves it. Infrastructure files alone are not proof of deployment.

## Current implementation status

- Implemented in source: optional S3 evidence storage through the Node API; private encrypted S3 CloudFormation template; least-privilege policy template.
- Not verified in AWS: bucket deployment, IAM role, S3 upload/retrieval, App Runner, Amplify, RDS, CloudWatch, custom domain, cost alerts.
- Not yet implemented: presigned direct uploads; public listing SEO/sitemap; full cloud deployment automation.

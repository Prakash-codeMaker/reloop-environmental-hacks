# ReLoop production deployment runbook

This package includes a production-oriented single-server deployment path. **It is not a certification that the application is ready for high-scale or regulated payment operations.** ReLoop still needs a real business-verification provider account and provider-specific adapter, and seller payouts/escrow are intentionally not implemented.

## Included in this bundle

- PostgreSQL persistence with separate tables for users, material batches, offers, notifications, audit entries, payment records, one-time authentication tokens, and idempotent payment/KYB webhook events. Important lookup columns are indexed. Records retain a JSONB payload while the application migrates toward repository-level SQL queries.
- Production startup refuses to fall back to local JSON, requires a strong session secret, HTTPS base URL, email-provider credentials, a bootstrap admin, and a signed external-verification callback secret.
- Email verification links expire after 24 hours. Password-reset links expire after one hour, are stored as hashes, are single-use, and invalidate prior sessions after a successful reset.
- Razorpay webhook signature validation uses the raw request body and `X-Razorpay-Signature`; duplicate event IDs are idempotent. A client-side payment signature alone is not treated as final settlement.
- Generic signed KYB webhook adapter, audit records, rate-limited account entry points, origin allow-listing, secure cookies, and hardened response headers.
- Docker Compose, Caddy automatic HTTPS, persistent database/upload volumes, and backup/restore scripts.

## 1. Requirements and domain

- A Linux VPS or server with Docker Engine and Docker Compose plugin.
- A domain whose DNS `A`/`AAAA` records point to that server.
- Inbound ports 80 and 443 open; do not expose PostgreSQL publicly.
- A Resend account with a verified sender/domain. Configure SPF/DKIM records as Resend instructs before enabling production email.
- A business-verification vendor/gateway with a webhook capable of signing raw request bodies. See the integration contract below.
- Razorpay account and approval for fees only if payment collection is enabled. Payment keys are optional; payments stay disabled if not configured.

## 2. Create production environment

Copy `.env.example` to `.env`, then set real values. Never commit `.env`.

Generate secrets on the server:

```bash
openssl rand -hex 48
openssl rand -hex 32
```

Use the first output for `RELOOP_SESSION_SECRET` and the second for `KYB_WEBHOOK_SECRET` (and use a different secret for Razorpay webhooks in Razorpay's dashboard). Use a long URL-safe random `POSTGRES_PASSWORD` made from letters and numbers so the Compose-generated `DATABASE_URL` does not need URL encoding.

Required values for the bundled VPS deployment:

```dotenv
NODE_ENV=production
POSTGRES_DB=reloop
POSTGRES_USER=reloop_app
POSTGRES_PASSWORD=<long-random-url-safe-password>
RELOOP_DOMAIN=app.yourdomain.com
RELOOP_SESSION_SECRET=<at-least-64-random-characters>
RELOOP_ADMIN_EMAIL=<operator-email>
RELOOP_ADMIN_PASSWORD=<unique-password-at-least-16-characters>
RELOOP_ADMIN_NAME=ReLoop Operations
RESEND_API_KEY=<Resend API key>
RELOOP_FROM_EMAIL=ReLoop <verified-sender@yourdomain.com>
KYB_WEBHOOK_SECRET=<unique-random-secret-at-least-32-characters>
```

The Compose file sets `APP_BASE_URL`, `RELOOP_ALLOWED_ORIGINS`, `DATABASE_URL`, and `PGSSLMODE=disable` for its private Docker-network PostgreSQL service. If using a managed PostgreSQL service instead, do not use the local database service configuration: set `DATABASE_URL` to the provider's TLS connection string and leave `PGSSLMODE` at `require` or use the provider's documented certificate settings.

Do not use example credentials. Restrict `.env` permissions (`chmod 600 .env`).

## 3. Start with HTTPS

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app caddy
```

Caddy obtains and renews a TLS certificate automatically once public DNS resolves and ports 80/443 are reachable. Check:

```bash
curl -fsS https://app.yourdomain.com/api/health
```

The health response reports `database: connected`. Create the first administrator from the configured bootstrap credentials, then rotate/secure that password according to your operations policy. Admin accounts cannot be created through public registration.

## 4. Existing JSON data migration

Stop the old server and back up the JSON data and uploads first. To import a local `server/data/reloop.json` into an empty PostgreSQL database, set `DATABASE_URL` and `PGSSLMODE`, then run:

```bash
node scripts/migrate-json-to-postgres.mjs
```

For a managed database, use its TLS-required connection settings. The importer refuses to run if the destination already contains users. Do not run it against a live database without a separate verified backup and maintenance window.

## 5. Email verification and password recovery

- Production registration sends a 24-hour verification link. Users cannot sign in until the link is used.
- The login screen includes a resend-verification action after an unverified sign-in attempt.
- Password reset responses do not reveal whether an email is registered. The one-hour token is single-use; a reset increments the session version so existing sessions stop working.
- Verify your Resend domain and test delivery, spam placement, token expiry, token reuse, and account enumeration before public launch.

## 6. External business verification (KYB) adapter

The API endpoint is:

`POST https://app.yourdomain.com/api/integrations/kyb/webhook`

Headers:

- `Content-Type: application/json`
- `X-ReLoop-KYB-Signature: <hex HMAC-SHA256 of the exact raw request body using KYB_WEBHOOK_SECRET>`

Payload example:

```json
{
  "eventId": "provider-event-unique-id",
  "userId": "USR-...",
  "provider": "YourProvider",
  "providerReference": "provider-case-reference",
  "status": "verified"
}
```

Allowed statuses are `verified`, `rejected`, and `pending`. Event IDs are idempotent. The receiving endpoint authenticates the callback and records the provider's decision; it does **not** initiate a provider check or independently prove the submitted decision. Before live use, configure the chosen provider to send signed callbacks, implement its required verification/session-creation API and callback mapping, validate the provider's event authenticity and result fields, and complete privacy/legal review. Do not mark a company verified based only on user-submitted documents or an unsigned request.

## 7. Payments and settlement safeguards

If enabling Razorpay, configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and an approved `RELOOP_PLATFORM_FEE_PAISE` together. Configure the provider webhook URL:

`https://app.yourdomain.com/api/payments/webhook`

Subscribe to `payment.captured` and `order.paid` events. The webhook secret is separate from the API key secret. Verify the webhook signature in test mode first, confirm duplicate events are harmless, and reconcile amounts/order IDs with the provider dashboard.

Current code can create a configured platform-fee order for an eligible completed transaction and record a captured event. It does **not** implement seller payouts, escrow, refunds, chargebacks, tax invoices, settlement ledger, dispute operations or automated provider reconciliation beyond the webhook. Keep payment keys absent and payments disabled until a payment policy, accounting process and legal review are approved. Never call a transaction settled just because the browser reports success.

## 8. Backups and restore drills

Run a backup:

```bash
./scripts/backup.sh
```

This creates a PostgreSQL dump and upload archive plus checksums under `backups/`. Copy backups off-server to encrypted object storage with restricted access and retention. Do not rely on the VPS disk as the only backup. A daily cron example is:

```cron
15 2 * * * cd /srv/reloop && ./scripts/backup.sh >> /var/log/reloop-backup.log 2>&1
```

Restore (destructive; requires confirmation):

```bash
./scripts/restore-backup.sh backups/reloop-db-<timestamp>.sql.gz backups/reloop-uploads-<timestamp>.tar.gz
```

Schedule regular restore drills in a separate environment and verify login, listings, offers, evidence access and webhook idempotency afterward.

## 9. Operational checks before public launch

- Run `npm run test:api` and build the frontend (`npm run build`).
- Verify registration, email verification expiry/reuse, login throttling, password reset, session invalidation and admin account setup.
- Test PostgreSQL restart, backup/restore, volume persistence and application restart.
- Test valid/invalid/duplicate KYB and Razorpay webhook signatures with the provider's test tools.
- Confirm privacy notice, consent, data retention, business document access controls and deletion policy.
- Configure uptime/error monitoring, log rotation, alerting, dependency scanning, secret rotation and incident contacts.
- Review file upload malware scanning and private object storage before scaling beyond a controlled pilot.

## Current scale boundary

The data is persisted in separate PostgreSQL tables with indexed identity/status columns, but the current compatibility layer loads records into the application and serializes writes across the dataset. This keeps the existing prototype API behaviour consistent and is suitable only for a controlled pilot with modest volume. Before multi-instance or high-throughput production, replace this compatibility layer with query-level repository methods and transactional SQL updates, add shared rate limiting, move evidence to private object storage, and load-test race conditions. Do not treat this bundle as a completed security audit or compliance certification.

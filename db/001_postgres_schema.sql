-- ReLoop entity tables. The server also applies this idempotent schema on startup.
CREATE TABLE IF NOT EXISTS reloop_users (id text PRIMARY KEY, email text UNIQUE NOT NULL, role text NOT NULL, disabled boolean NOT NULL DEFAULT false, created_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_batches (id text PRIMARY KEY, seller_id text, collector_id text, status text, category text, created_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_offers (id text PRIMARY KEY, batch_id text, buyer_id text, status text, created_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_notifications (id text PRIMARY KEY, user_id text, created_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_audit (id text PRIMARY KEY, actor_id text, entity_type text, entity_id text, created_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_payments (id text PRIMARY KEY, user_id text, batch_id text, order_id text UNIQUE, status text, created_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_auth_tokens (id text PRIMARY KEY, user_id text, purpose text, expires_at timestamptz, created_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_payment_webhook_events (event_id text PRIMARY KEY, event_name text, received_at timestamptz, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reloop_kyb_webhook_events (event_id text PRIMARY KEY, user_id text, provider text, received_at timestamptz, payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS reloop_users_role_idx ON reloop_users(role);
CREATE INDEX IF NOT EXISTS reloop_batches_discovery_idx ON reloop_batches(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS reloop_batches_seller_idx ON reloop_batches(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reloop_batches_collector_idx ON reloop_batches(collector_id, status);
CREATE INDEX IF NOT EXISTS reloop_offers_batch_idx ON reloop_offers(batch_id, status);
CREATE INDEX IF NOT EXISTS reloop_offers_buyer_idx ON reloop_offers(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reloop_notifications_user_idx ON reloop_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reloop_audit_entity_idx ON reloop_audit(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reloop_auth_tokens_expiry_idx ON reloop_auth_tokens(purpose, expires_at);

CREATE TABLE IF NOT EXISTS reloop_issues (id text PRIMARY KEY, reporter_id text NOT NULL, status text NOT NULL, category text NOT NULL, created_at timestamptz NOT NULL, payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS reloop_issues_reporter_idx ON reloop_issues(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reloop_issues_status_idx ON reloop_issues(status, created_at DESC);

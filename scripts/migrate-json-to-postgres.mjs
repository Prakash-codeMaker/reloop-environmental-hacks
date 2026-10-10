// One-time importer for the existing JSON store. Run with DATABASE_URL set and
// RELOOP_DATA_DIR pointing at the directory containing reloop.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running this migration.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.RELOOP_DATA_DIR ? path.join(process.env.RELOOP_DATA_DIR, 'reloop.json') : path.join(root, 'server', 'data', 'reloop.json');
if (!fs.existsSync(file)) throw new Error(`No JSON store found at ${file}`);
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const { Pool } = await import('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } });
const tables = [
  {key:'users',table:'reloop_users',id:'id',sqlId:'id',cols:['email','role','disabled','created_at'],values:r=>[r.email,r.role,r.disabled===true,r.createdAt||null]},
  {key:'batches',table:'reloop_batches',id:'id',sqlId:'id',cols:['seller_id','collector_id','status','category','created_at'],values:r=>[r.sellerId||null,r.collectorId||null,r.status||null,r.category||null,r.createdAt||null]},
  {key:'offers',table:'reloop_offers',id:'id',sqlId:'id',cols:['batch_id','buyer_id','status','created_at'],values:r=>[r.batchId||null,r.buyerId||null,r.status||null,r.createdAt||null]},
  {key:'notifications',table:'reloop_notifications',id:'id',sqlId:'id',cols:['user_id','created_at'],values:r=>[r.userId||null,r.createdAt||null]},
  {key:'audit',table:'reloop_audit',id:'id',sqlId:'id',cols:['actor_id','entity_type','entity_id','created_at'],values:r=>[r.actorId||null,r.entityType||null,r.entityId||null,r.createdAt||null]},
  {key:'payments',table:'reloop_payments',id:'id',sqlId:'id',cols:['user_id','batch_id','order_id','status','created_at'],values:r=>[r.userId||null,r.batchId||null,r.orderId||null,r.status||null,r.createdAt||null]},
  {key:'authTokens',table:'reloop_auth_tokens',id:'id',sqlId:'id',cols:['user_id','purpose','expires_at','created_at'],values:r=>[r.userId||null,r.purpose||null,r.expiresAt||null,r.createdAt||null]},
  {key:'paymentWebhookEvents',table:'reloop_payment_webhook_events',id:'eventId',sqlId:'event_id',cols:['event_name','received_at'],values:r=>[r.event||null,r.receivedAt||null]},
  {key:'kybWebhookEvents',table:'reloop_kyb_webhook_events',id:'eventId',sqlId:'event_id',cols:['user_id','provider','received_at'],values:r=>[r.userId||null,r.provider||null,r.receivedAt||null]},
];
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_users (id text PRIMARY KEY, email text UNIQUE NOT NULL, role text NOT NULL, disabled boolean NOT NULL DEFAULT false, created_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_batches (id text PRIMARY KEY, seller_id text, collector_id text, status text, category text, created_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_offers (id text PRIMARY KEY, batch_id text, buyer_id text, status text, created_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_notifications (id text PRIMARY KEY, user_id text, created_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_audit (id text PRIMARY KEY, actor_id text, entity_type text, entity_id text, created_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_payments (id text PRIMARY KEY, user_id text, batch_id text, order_id text UNIQUE, status text, created_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_auth_tokens (id text PRIMARY KEY, user_id text, purpose text, expires_at timestamptz, created_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_payment_webhook_events (event_id text PRIMARY KEY, event_name text, received_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reloop_kyb_webhook_events (event_id text PRIMARY KEY, user_id text, provider text, received_at timestamptz, payload jsonb NOT NULL)`);
  await pool.query('BEGIN');
  for (const t of tables) { const check = await pool.query(`SELECT count(*)::int AS count FROM ${t.table}`); if (check.rows[0].count) throw new Error(`Target table ${t.table} is not empty; migration aborted to avoid overwriting existing records.`); }
  for (const t of tables) for (const r of state[t.key] || []) {
    const cols=[t.sqlId,...t.cols,'payload'];
    const vals=[String(r[t.id]),...t.values(r),JSON.stringify(r)];
    const placeholders=vals.map((_,i)=>i===vals.length-1?`$${i+1}::jsonb`:`$${i+1}`).join(',');
    await pool.query(`INSERT INTO ${t.table} (${cols.join(',')}) VALUES (${placeholders})`, vals);
  }
  await pool.query('COMMIT');
  console.log(`Imported legacy data from ${file}.`);
} catch (error) { await pool.query('ROLLBACK').catch(()=>{}); throw error; }
finally { await pool.end(); }

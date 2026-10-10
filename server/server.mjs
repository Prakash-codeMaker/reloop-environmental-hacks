import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
if (fs.existsSync(ENV_PATH)) { for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m && !m[1].startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2'); } }
const DATA_DIR = process.env.RELOOP_DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'reloop.json');
const USE_POSTGRES = Boolean(process.env.DATABASE_URL);
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const S3_BUCKET = (process.env.RELOOP_S3_BUCKET || '').trim();
const S3_REGION = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1').trim();
const OPENSEARCH_URL = (process.env.RELOOP_OPENSEARCH_URL || '').trim().replace(/\/$/, '');
let s3Runtime = null;
const PORT = Number(process.env.API_PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || 'development';
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true' || NODE_ENV === 'production';
const COOKIE_NAME = 'reloop_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const MAX_BODY = 10 * 1024 * 1024;
const MATERIALS = new Set(['Cardboard', 'Paper', 'Plastic', 'Metal', 'Glass', 'Textiles', 'Other']);
const ROLES = new Set(['generator', 'buyer', 'collector']);
const LOGIN_ROLES = new Set([...ROLES, 'admin']);
const BATCH_STATES = new Set(['Listed', 'Offer received', 'Offer accepted', 'Collection scheduled', 'Collected', 'Completed', 'Cancelled', 'Needs review', 'Disputed']);
const OFFER_STATES = new Set(['Pending', 'Accepted', 'Declined', 'Withdrawn']);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
const STATE_KEYS = ['users','batches','offers','notifications','audit','payments','authTokens','paymentWebhookEvents','kybWebhookEvents','issues'];
const EMPTY_STATE = Object.fromEntries(STATE_KEYS.map(key => [key, []]));
const db = { ...EMPTY_STATE, ...loadJson(DB_PATH, EMPTY_STATE) };
for (const k of STATE_KEYS) if (!Array.isArray(db[k])) db[k] = [];
let saveChain = Promise.resolve();
let pgPool = null;
let activePgClient = null;
let pgQueue = Promise.resolve();
function applyState(state) { for (const key of STATE_KEYS) db[key] = Array.isArray(state?.[key]) ? state[key] : []; }
function snapshotState() { return Object.fromEntries(STATE_KEYS.map(key => [key, db[key]])); }
const PG_TABLES = [
  { key:'users', table:'reloop_users', id:'id', columns:['email','role','disabled','created_at'], values:r=>[r.email,r.role,r.disabled===true,r.createdAt||null] },
  { key:'batches', table:'reloop_batches', id:'id', columns:['seller_id','collector_id','status','category','created_at'], values:r=>[r.sellerId||null,r.collectorId||null,r.status||null,r.category||null,r.createdAt||null] },
  { key:'offers', table:'reloop_offers', id:'id', columns:['batch_id','buyer_id','status','created_at'], values:r=>[r.batchId||null,r.buyerId||null,r.status||null,r.createdAt||null] },
  { key:'notifications', table:'reloop_notifications', id:'id', columns:['user_id','created_at'], values:r=>[r.userId||null,r.createdAt||null] },
  { key:'audit', table:'reloop_audit', id:'id', columns:['actor_id','entity_type','entity_id','created_at'], values:r=>[r.actorId||null,r.entityType||null,r.entityId||null,r.createdAt||null] },
  { key:'payments', table:'reloop_payments', id:'id', columns:['user_id','batch_id','order_id','status','created_at'], values:r=>[r.userId||null,r.batchId||null,r.orderId||null,r.status||null,r.createdAt||null] },
  { key:'authTokens', table:'reloop_auth_tokens', id:'id', columns:['user_id','purpose','expires_at','created_at'], values:r=>[r.userId||null,r.purpose||null,r.expiresAt||null,r.createdAt||null] },
  { key:'paymentWebhookEvents', table:'reloop_payment_webhook_events', id:'eventId', sqlId:'event_id', columns:['event_name','received_at'], values:r=>[r.event||null,r.receivedAt||null] },
  { key:'kybWebhookEvents', table:'reloop_kyb_webhook_events', id:'eventId', sqlId:'event_id', columns:['user_id','provider','received_at'], values:r=>[r.userId||null,r.provider||null,r.receivedAt||null] },
  { key:'issues', table:'reloop_issues', id:'id', columns:['reporter_id','status','category','created_at'], values:r=>[r.reporterId||null,r.status||null,r.category||null,r.createdAt||null] },
];
const PG_DDL = [
  `CREATE TABLE IF NOT EXISTS reloop_users (id text PRIMARY KEY, email text UNIQUE NOT NULL, role text NOT NULL, disabled boolean NOT NULL DEFAULT false, created_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_batches (id text PRIMARY KEY, seller_id text, collector_id text, status text, category text, created_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_offers (id text PRIMARY KEY, batch_id text, buyer_id text, status text, created_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_notifications (id text PRIMARY KEY, user_id text, created_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_audit (id text PRIMARY KEY, actor_id text, entity_type text, entity_id text, created_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_payments (id text PRIMARY KEY, user_id text, batch_id text, order_id text UNIQUE, status text, created_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_auth_tokens (id text PRIMARY KEY, user_id text, purpose text, expires_at timestamptz, created_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_payment_webhook_events (event_id text PRIMARY KEY, event_name text, received_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_kyb_webhook_events (event_id text PRIMARY KEY, user_id text, provider text, received_at timestamptz, payload jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reloop_issues (id text PRIMARY KEY, reporter_id text NOT NULL, status text NOT NULL, category text NOT NULL, created_at timestamptz NOT NULL, payload jsonb NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS reloop_users_role_idx ON reloop_users(role)`,
  `CREATE INDEX IF NOT EXISTS reloop_batches_discovery_idx ON reloop_batches(status, category, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS reloop_batches_seller_idx ON reloop_batches(seller_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS reloop_batches_collector_idx ON reloop_batches(collector_id, status)`,
  `CREATE INDEX IF NOT EXISTS reloop_offers_batch_idx ON reloop_offers(batch_id, status)`,
  `CREATE INDEX IF NOT EXISTS reloop_offers_buyer_idx ON reloop_offers(buyer_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS reloop_notifications_user_idx ON reloop_notifications(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS reloop_audit_entity_idx ON reloop_audit(entity_type, entity_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS reloop_auth_tokens_expiry_idx ON reloop_auth_tokens(purpose, expires_at)`,
  `CREATE INDEX IF NOT EXISTS reloop_issues_reporter_idx ON reloop_issues(reporter_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS reloop_issues_status_idx ON reloop_issues(status, created_at DESC)`,
];
function sqlIdent(value) { if (!/^[a-z_]+$/.test(value)) throw new Error('Invalid SQL identifier.'); return `"${value}"`; }
async function loadPgState(client, lock=false) {
  const state = { ...EMPTY_STATE };
  for (const config of PG_TABLES) {
    const orderColumn = config.columns.includes('created_at') ? 'created_at' : config.columns.includes('received_at') ? 'received_at' : null;
    const order = orderColumn ? ` ORDER BY ${orderColumn} DESC NULLS LAST` : '';
    const result = await client.query(`SELECT payload FROM ${config.table}${order}${lock?' FOR UPDATE':''}`);
    state[config.key] = result.rows.map(row => row.payload);
  }
  applyState(state);
}
async function persistPgState(client) {
  for (const config of PG_TABLES) {
    const records = db[config.key] || [];
    const keys = records.map(record => String(record[config.id])).filter(Boolean);
    if (keys.length) await client.query(`DELETE FROM ${config.table} WHERE ${sqlIdent(config.sqlId || config.id)} <> ALL($1::text[])`, [keys]);
    else await client.query(`DELETE FROM ${config.table}`);
    const columnNames = [config.sqlId || config.id, ...config.columns, 'payload'];
    const cols = columnNames.map(sqlIdent).join(',');
    const placeholders = columnNames.map((_,i)=>i===columnNames.length-1?`$${i+1}::jsonb`:`$${i+1}`).join(',');
    const updates = [...config.columns, 'payload'].map(column=>`${sqlIdent(column)}=EXCLUDED.${sqlIdent(column)}`).join(',');
    for (const record of records) {
      const values = [String(record[config.id]), ...config.values(record), JSON.stringify(record)];
      await client.query(`INSERT INTO ${config.table} (${cols}) VALUES (${placeholders}) ON CONFLICT (${sqlIdent(config.sqlId || config.id)}) DO UPDATE SET ${updates}`, values);
    }
  }
}
async function saveDb() {
  if (activePgClient) { await persistPgState(activePgClient); return; }
  if (pgPool) {
    const client = await pgPool.connect();
    try { await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(741905211)'); await persistPgState(client); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { client.release(); }
    return;
  }
  saveChain = saveChain.then(() => new Promise((resolve, reject) => {
    const tmp = `${DB_PATH}.${process.pid}.tmp`;
    fs.writeFile(tmp, JSON.stringify(snapshotState(), null, 2), err => { if (err) return reject(err); fs.rename(tmp, DB_PATH, err2 => err2 ? reject(err2) : resolve()); });
  }));
  return saveChain;
}
async function initPostgres() {
  if (!USE_POSTGRES) return;
  const { Pool } = await import('pg');
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }, max: Number(process.env.PG_POOL_MAX || 5), idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
  for (const ddl of PG_DDL) await pgPool.query(ddl);
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(741905211)');
    const count = await client.query('SELECT count(*)::int AS count FROM reloop_users');
    const localState = loadJson(DB_PATH, EMPTY_STATE);
    if (count.rows[0].count === 0 && Array.isArray(localState.users) && localState.users.length) { applyState(localState); await persistPgState(client); console.log('Imported existing local ReLoop JSON data into the empty PostgreSQL store.'); }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { client.release(); }
  const readClient = await pgPool.connect();
  try { await readClient.query('BEGIN'); await loadPgState(readClient); await readClient.query('COMMIT'); }
  catch(error) { await readClient.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { readClient.release(); }
  console.log('ReLoop persistence: PostgreSQL relational tables enabled.');
}

async function withStoreRequest(req, res) {
  const client = pgPool ? await pgPool.connect() : null;
  let advisoryLocked = false;
  let finishedResolve;
  const finished = new Promise(resolve => { finishedResolve = resolve; });
  if (res.writableFinished || res.destroyed) finishedResolve();
  else { res.once('finish', finishedResolve); res.once('close', finishedResolve); }
  let routeFailed = false;
  try {
    if (client) {
      const writes = ['POST','PATCH','PUT','DELETE'].includes(req.method) || new URL(req.url, 'http://localhost').pathname === '/api/auth/verify-email';
      // Session-level lock is acquired before the transaction snapshot, avoiding stale snapshots after lock waits.
      if (writes) { await client.query('SELECT pg_advisory_lock(741905211)'); advisoryLocked = true; }
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await loadPgState(client, writes);
      activePgClient = client;
    }
    try { await route(req, res); }
    catch (err) { routeFailed = true; console.error('Request error:', err); if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Unexpected server error. Check server logs.' }); else if (!res.writableEnded) res.end(); }
    await finished;
    if (client) { if (routeFailed) await client.query('ROLLBACK'); else await client.query('COMMIT'); }
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(()=>{});
    console.error('Request/store error:', err);
    if (!res.headersSent) send(res, 503, { error: 'The shared data store is temporarily unavailable. Please retry.' });
    else if (!res.writableEnded) res.end();
  } finally {
    activePgClient = null;
    if (client && advisoryLocked) await client.query('SELECT pg_advisory_unlock(741905211)').catch(()=>{});
    if (client) client.release();
  }
}
let secret = process.env.RELOOP_SESSION_SECRET;
const secretPath = path.join(DATA_DIR, '.session-secret');
if (!secret) {
  if (fs.existsSync(secretPath)) secret = fs.readFileSync(secretPath, 'utf8').trim();
  else { secret = crypto.randomBytes(48).toString('hex'); fs.writeFileSync(secretPath, secret, { mode: 0o600 }); }
}
const nowIso = () => new Date().toISOString();
const id = prefix => `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const ROLE_VERIFICATION = {
  generator: { organization: 'Business identity', role: 'Material-source profile', organizationDocs: ['business_registration','tax_document','address_proof'], roleDocs: ['material_source_proof'] },
  buyer: { organization: 'Business identity', role: 'Buyer capability', organizationDocs: ['business_registration','tax_document','address_proof'], roleDocs: ['buyer_authorization','processing_capability'] },
  collector: { organization: 'Identity and contact', role: 'Collection capability', organizationDocs: ['identity_proof','address_proof'], roleDocs: ['vehicle_document','transport_permit'] }
};
function verificationChecksFor(u) {
  const cfg = ROLE_VERIFICATION[u.role] || ROLE_VERIFICATION.generator;
  const docs = Array.isArray(u.verificationEvidence) ? u.verificationEvidence : [];
  const statusFor = relevant => u.verificationStatus === 'verified' ? 'verified' : u.verificationStatus === 'rejected' ? 'rejected' : docs.some(d => relevant.includes(d.documentType)) ? 'in_review' : 'pending';
  return [
    { key:'contact', label:'Email contact', status:u.emailVerified === true ? 'verified' : 'pending', detail:u.emailVerified === true ? 'Email address confirmed' : 'Confirm your email address' },
    { key:'organization', label:cfg.organization, status:statusFor(cfg.organizationDocs), detail:docs.some(d => cfg.organizationDocs.includes(d.documentType)) ? 'Supporting document submitted' : 'Submit one relevant document for review' },
    { key:'role', label:cfg.role, status:statusFor(cfg.roleDocs), detail:docs.some(d => cfg.roleDocs.includes(d.documentType)) ? 'Role-specific evidence submitted' : 'Additional checks may be required for this role' }
  ];
}
const safeUser = u => ({ id: u.id, email: u.email, emailVerified: u.emailVerified === true, businessName: u.businessName, role: u.role, phone: u.phone || '', language: u.language || null, verificationStatus: u.verificationStatus || 'pending', verificationChecks: verificationChecksFor(u), createdAt: u.createdAt });
const cleanBatch = b => ({ ...b, evidence: (b.evidence || []).map(({ storageKey, ...e }) => e), sellerName: db.users.find(u => u.id === b.sellerId)?.businessName || b.sellerName || 'Business participant' });
function audit(actorId, action, entityType, entityId, details = {}) {
  db.audit.unshift({ id: id('AUD'), actorId, action, entityType, entityId, details, createdAt: nowIso() });
  if (db.audit.length > 5000) db.audit.length = 5000;
}
function notify(userId, title, message, entityType, entityId) {
  if (!userId) return;
  db.notifications.unshift({ id: id('NTF'), userId, title, message, entityType, entityId, readAt: null, createdAt: nowIso() });
  if (db.notifications.length > 10000) db.notifications.length = 10000;
}
function b64url(value) { return Buffer.from(value).toString('base64url'); }
function sign(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const input = `${head}.${body}`;
  return `${input}.${crypto.createHmac('sha256', secret).update(input).digest('base64url')}`;
}
function verifyToken(token) {
  try {
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
function cookieMap(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${NODE_ENV === 'production' ? '; Secure' : ''}`;
}
function clearCookie() { return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${NODE_ENV === 'production' ? '; Secure' : ''}`; }
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''; let tooLarge = false;
    req.on('data', chunk => { raw += chunk; if (raw.length > MAX_BODY) tooLarge = true; });
    req.on('end', () => {
      if (tooLarge) return reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('Send a valid JSON request body.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function parseRawBody(req, limit = 1024*1024) {
  return new Promise((resolve, reject) => { const chunks=[]; let size=0; req.on('data', chunk => { size += chunk.length; if (size > limit) { reject(Object.assign(new Error('Request body is too large.'), { status:413 })); req.destroy(); return; } chunks.push(chunk); }); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
}

function send(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders });
  res.end(JSON.stringify(data));
}
function fail(res, status, message) { send(res, status, { error: message }); }
function sendHtml(res, status, body) { res.writeHead(status, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'", 'X-Content-Type-Options':'nosniff' }); res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReLoop account</title><body style="font:16px system-ui;max-width:640px;margin:12vh auto;padding:24px;color:#202923">${body}<p><a href="${APP_BASE_URL}/?workspace=live">Return to ReLoop sign in</a></p></body></html>`); }
function requireAuth(req, res) {
  const token = cookieMap(req)[COOKIE_NAME];
  const payload = token && verifyToken(token);
  const user = payload && db.users.find(u => u.id === payload.sub && u.disabled !== true && (payload.sv === undefined || payload.sv === (u.sessionVersion || 0)));
  if (user && REQUIRE_EMAIL_VERIFICATION && user.emailVerified !== true) { fail(res, 403, 'Verify your email address before using ReLoop.'); return null; }
  if (!user) { fail(res, 401, 'Please sign in to continue.'); return null; }
  return user;
}
function requireRole(res, user, roles) {
  if (!roles.includes(user.role)) { fail(res, 403, 'Your account does not have permission to perform this action.'); return false; }
  return true;
}
function validString(value, max = 200) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
function fileSignatureMatches(buffer, contentType) { if (contentType === 'application/pdf') return buffer.subarray(0,5).toString('ascii') === '%PDF-'; if (contentType === 'image/png') return buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])); if (contentType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; return false; }
async function getS3Runtime() {
  if (!S3_BUCKET) return null;
  if (!s3Runtime) {
    const sdk = await import('@aws-sdk/client-s3');
    s3Runtime = { client: new sdk.S3Client({ region: S3_REGION }), PutObjectCommand: sdk.PutObjectCommand, GetObjectCommand: sdk.GetObjectCommand };
  }
  return s3Runtime;
}
function evidenceExtension(contentType) { return contentType === 'image/jpeg' ? '.jpg' : contentType === 'image/png' ? '.png' : '.pdf'; }
async function storeEvidence(buffer, { fileId, contentType, ownerId, kind }) {
  const ext = evidenceExtension(contentType);
  if (S3_BUCKET) {
    const runtime = await getS3Runtime();
    const key = `private/${kind}/${ownerId}/${fileId}${ext}`;
    await runtime.client.send(new runtime.PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType, ServerSideEncryption: 'AES256', Metadata: { 'reloop-file-id': fileId, 'reloop-kind': kind } }));
    return { storage: 's3', storageKey: key };
  }
  fs.writeFileSync(path.join(UPLOAD_DIR, `${fileId}${ext}`), buffer, { flag: 'wx', mode: 0o600 });
  return { storage: 'local' };
}
async function readEvidence(evidence) {
  if (evidence.storage === 's3' && evidence.storageKey) {
    const runtime = await getS3Runtime();
    if (!runtime) throw new Error('S3 evidence configured but AWS SDK runtime unavailable.');
    const result = await runtime.client.send(new runtime.GetObjectCommand({ Bucket: S3_BUCKET, Key: evidence.storageKey }));
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return fs.readFileSync(path.join(UPLOAD_DIR, `${evidence.id}${evidenceExtension(evidence.contentType)}`));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve({ salt, hash: key.toString('hex') })));
}
async function passwordMatches(password, user) {
  const result = await hashPassword(password, user.passwordSalt);
  const a = Buffer.from(result.hash, 'hex'); const b = Buffer.from(user.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function workspaceData(user) {
  let batches;
  let offers;
  if (user.role === 'generator') {
    batches = db.batches.filter(b => b.sellerId === user.id);
    const ownIds = new Set(batches.map(b => b.id));
    offers = db.offers.filter(o => ownIds.has(o.batchId));
  } else if (user.role === 'buyer') {
    batches = db.batches.filter(b => b.status !== 'Completed' && b.status !== 'Cancelled' && b.sellerId !== user.id);
    offers = db.offers.filter(o => o.buyerId === user.id);
  } else if (user.role === 'collector') {
    batches = db.batches.filter(b => b.collectorId === user.id);
    const ownIds = new Set(batches.map(b => b.id));
    offers = db.offers.filter(o => ownIds.has(o.batchId));
  } else {
    batches = db.batches; offers = db.offers;
  }
  return { user: safeUser(user), batches: batches.map(cleanBatch), offers: offers.map(o => ({ ...o, buyerName: db.users.find(u => u.id === o.buyerId)?.businessName || o.buyerName || 'Buyer' })), notifications: db.notifications.filter(n => n.userId === user.id).slice(0, 50), unreadCount: db.notifications.filter(n => n.userId === user.id && !n.readAt).length };
}
function canSeeBatch(user, batch) {
  return user.role === 'admin' || batch.sellerId === user.id || batch.collectorId === user.id || (user.role === 'buyer' && !['Completed','Cancelled'].includes(batch.status)) || db.offers.some(o => o.batchId === batch.id && o.buyerId === user.id);
}
function canParticipateInBatch(user, batch) {
  return user.role === 'admin' || batch.sellerId === user.id || batch.collectorId === user.id || db.offers.some(o => o.batchId === batch.id && o.buyerId === user.id);
}
function distanceScore(locationA = '', locationB = '') {
  const a = locationA.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const b = locationB.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!a.length || !b.length) return 0;
  const common = a.filter(x => b.includes(x) && x.length > 2);
  return common.length ? Math.min(1, common.length / Math.max(1, Math.min(a.length, b.length))) : 0;
}
async function maybeSendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !process.env.RELOOP_FROM_EMAIL || !to) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.RELOOP_FROM_EMAIL, to: [to], subject, html }) });
    if (!response.ok) { console.error('Email provider rejected message:', response.status); return false; }
    return true;
  } catch (err) { console.error('Email provider request failed:', err.message); return false; }
}

function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function createOneTimeToken(userId, purpose, ttlMs) {
  db.authTokens = db.authTokens.filter(t => !(t.userId === userId && t.purpose === purpose));
  const token = crypto.randomBytes(32).toString('base64url');
  db.authTokens.push({ id: id('TOK'), userId, purpose, tokenHash: tokenHash(token), expiresAt: new Date(Date.now()+ttlMs).toISOString(), createdAt: nowIso() });
  return token;
}
function consumeOneTimeToken(token, purpose) {
  if (!validString(token, 300)) return null;
  const hash = tokenHash(token);
  const item = db.authTokens.find(t => t.purpose === purpose && t.tokenHash === hash && Date.parse(t.expiresAt) > Date.now());
  if (!item) return null;
  db.authTokens = db.authTokens.filter(t => t.id !== item.id);
  return db.users.find(u => u.id === item.userId) || null;
}
async function sendVerificationLink(user) {
  const token = createOneTimeToken(user.id, 'verify_email', 24*60*60*1000);
  const url = `${APP_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await maybeSendEmail(user.email, 'Verify your ReLoop email', `<p>Hello ${escapeHtml(user.businessName)},</p><p>Verify your email address to activate your ReLoop account.</p><p><a href="${url}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>`);
  if (!sent && REQUIRE_EMAIL_VERIFICATION) throw Object.assign(new Error('Email delivery is not configured. Please contact ReLoop support.'), { status: 503 });
  return token;
}
async function searchOpenSearchBatchIds(filters, candidates) {
  if (!OPENSEARCH_URL) return null;
  try {
    const indexUrl = `${OPENSEARCH_URL}/reloop-material-batches`;
    const indexResponse = await fetch(indexUrl, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mappings: { properties: {
        id: { type: 'keyword' }, material: { type: 'text' }, category: { type: 'keyword' },
        location: { type: 'text' }, quantity: { type: 'double' }, status: { type: 'keyword' },
        sellerName: { type: 'text' }, description: { type: 'text' }
      } } })
    });
    if (!indexResponse.ok && indexResponse.status !== 400) throw new Error(`OpenSearch index setup returned ${indexResponse.status}`);

    // Re-index only active, discoverable listing fields. Private account and evidence data are never indexed.
    if (candidates.length) {
      let bulk = '';
      for (const batch of candidates) {
        bulk += `${JSON.stringify({ index: { _index: 'reloop-material-batches', _id: batch.id } })}\n`;
        bulk += `${JSON.stringify({ id: batch.id, material: batch.material, category: batch.category, location: batch.location, quantity: Number(batch.quantity), status: batch.status, sellerName: batch.sellerName || '', description: batch.description || '' })}\n`;
      }
      const indexed = await fetch(`${OPENSEARCH_URL}/_bulk`, { method: 'POST', headers: { 'content-type': 'application/x-ndjson' }, body: bulk });
      if (!indexed.ok) throw new Error(`OpenSearch bulk indexing returned ${indexed.status}`);
      const result = await indexed.json();
      if (result.errors) throw new Error('OpenSearch reported one or more indexing errors');
    }

    const must = [];
    if (filters.q) must.push({ multi_match: { query: filters.q, fields: ['material^3', 'category^2', 'location', 'sellerName', 'description'], fuzziness: 'AUTO' } });
    const filter = [];
    if (filters.category) filter.push({ term: { category: filters.category } });
    if (filters.location) filter.push({ match: { location: { query: filters.location, operator: 'or' } } });
    if (filters.minQuantity || filters.maxQuantity) {
      const range = {};
      if (filters.minQuantity) range.gte = Number(filters.minQuantity);
      if (filters.maxQuantity) range.lte = Number(filters.maxQuantity);
      filter.push({ range: { quantity: range } });
    }
    const response = await fetch(`${indexUrl}/_search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ size: 1000, query: { bool: { ...(must.length ? { must } : {}), ...(filter.length ? { filter } : {}) } }, sort: [{ _score: 'desc' }] })
    });
    if (!response.ok) throw new Error(`OpenSearch query returned ${response.status}`);
    const payload = await response.json();
    return new Set((payload.hits?.hits || []).map(hit => String(hit._id)));
  } catch (error) {
    console.error('OpenSearch discovery unavailable; using built-in search fallback.', error?.message || 'unknown error');
    return null;
  }
}

function matchBatch(batch, filters) {
  const categoryMatch = !filters.category || batch.category.toLowerCase() === filters.category.toLowerCase();
  const queryMatch = !filters.q || [batch.material,batch.location,batch.id,batch.sellerName||''].join(' ').toLowerCase().includes(filters.q.toLowerCase());
  const minMatch = !filters.minQuantity || Number(batch.quantity) >= Number(filters.minQuantity);
  const maxMatch = !filters.maxQuantity || Number(batch.quantity) <= Number(filters.maxQuantity);
  const locationScore = distanceScore(batch.location, filters.location || '');
  const locationMatch = !filters.location || locationScore > 0;
  const quantityScore = minMatch && maxMatch ? 1 : 0;
  const dimensions = [];
  if (filters.category) dimensions.push({ value: categoryMatch ? 1 : 0, weight: 50 });
  if (filters.minQuantity || filters.maxQuantity) dimensions.push({ value: quantityScore, weight: 25 });
  if (filters.location) dimensions.push({ value: locationScore, weight: 25 });
  if (filters.q) dimensions.push({ value: queryMatch ? 1 : 0, weight: 25 });
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const score = totalWeight ? Math.round(dimensions.reduce((sum, d) => sum + d.value * d.weight, 0) / totalWeight * 100) : 0;
  return { categoryMatch, queryMatch, minMatch, maxMatch, locationMatch, score, reasons: [categoryMatch ? 'Material category matches' : 'Different material category', quantityScore ? 'Quantity fits your range' : 'Quantity is outside your range', locationScore ? 'Location shares matching locality terms' : 'Location similarity not established'] };
}
const loginAttempts = new Map();
function loginLimited(ip) {
  const now = Date.now(); const prev = loginAttempts.get(ip) || { count: 0, start: now };
  if (now - prev.start > 15 * 60 * 1000) { prev.count = 0; prev.start = now; }
  prev.count += 1; loginAttempts.set(ip, prev);
  if (loginAttempts.size > 10000) for (const [key,value] of loginAttempts) if (now-value.start > 15*60*1000) loginAttempts.delete(key);
  return prev.count > 12;
}
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  if (req.method === 'GET' && pathname === '/api/health') { if (pgPool) await pgPool.query('SELECT 1'); return send(res, 200, { status: 'ok', service: 'reloop-api', database: pgPool ? 'connected' : 'local-json', time: nowIso(), environment: NODE_ENV }); }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    if (loginLimited(`register:${req.socket.remoteAddress || 'unknown'}`)) return fail(res, 429, 'Too many account creation attempts. Try again in 15 minutes.');
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'generator');
    if (!validString(body.businessName, 120) || !/^\S+@\S+\.\S+$/.test(email) || !validString(body.password, 200) || String(body.password).length < 10) return fail(res, 400, 'Enter a business name, valid email, and password of at least 10 characters.');
    if (!ROLES.has(role)) return fail(res, 400, 'Choose a supported business role. Platform admin accounts cannot self-register.');
    if (db.users.some(u => u.email === email)) return fail(res, 409, 'An account with this email already exists.');
    const creds = await hashPassword(String(body.password));
    const user = { id: id('USR'), email, businessName: body.businessName.trim(), role, phone: validString(body.phone, 30) ? body.phone.trim() : '', language: ['en','hi','mr','gu','ta','te','kn'].includes(String(body.language||'')) ? String(body.language) : 'en', passwordSalt: creds.salt, passwordHash: creds.hash, emailVerified: !REQUIRE_EMAIL_VERIFICATION, sessionVersion: 0, verificationStatus: 'pending', createdAt: nowIso(), disabled: false };
    db.users.push(user); audit(user.id, 'account.created', 'user', user.id, { role });
    if (REQUIRE_EMAIL_VERIFICATION) {
      try { await sendVerificationLink(user); } catch (error) { db.users = db.users.filter(u => u.id !== user.id); db.authTokens = db.authTokens.filter(t => t.userId !== user.id); await saveDb(); return fail(res, error.status || 503, error.message); }
      await saveDb();
      return send(res, 201, { verificationRequired: true, message: 'Account created. Check your email for a verification link before signing in.', user: safeUser(user) });
    }
    user.emailVerified = true;
    await saveDb();
    const token = sign({ sub: user.id, sv: user.sessionVersion, exp: Math.floor(Date.now()/1000) + SESSION_SECONDS });
    return send(res, 201, { user: safeUser(user) }, { 'Set-Cookie': sessionCookie(token) });
  }
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    if (loginLimited(req.socket.remoteAddress || 'unknown')) return fail(res, 429, 'Too many sign-in attempts. Try again in 15 minutes.');
    const body = await parseBody(req); const email = String(body.email || '').trim().toLowerCase();
    const user = db.users.find(u => u.email === email && u.disabled !== true);
    if (!user || !validString(body.password, 200) || !(await passwordMatches(String(body.password), user))) return fail(res, 401, 'Email or password is incorrect.');
    const expectedRole = body.expectedRole === undefined || body.expectedRole === null || body.expectedRole === '' ? null : String(body.expectedRole);
    if (expectedRole && !LOGIN_ROLES.has(expectedRole)) return fail(res, 400, 'Choose a valid workspace role.');
    if (expectedRole && user.role !== expectedRole) {
      const roleLabel = ({ generator:'Material generator', buyer:'Buyer / recycler', collector:'Collector / logistics', admin:'Platform administrator' })[user.role] || 'assigned';
      return fail(res, 403, `This account is registered as ${roleLabel}. Select that role to sign in. Your account and password have not changed.`);
    }
    if (REQUIRE_EMAIL_VERIFICATION && user.emailVerified !== true) return fail(res, 403, 'Verify your email address using the link we sent before signing in.');
    const token = sign({ sub: user.id, sv: user.sessionVersion || 0, exp: Math.floor(Date.now()/1000) + SESSION_SECONDS });
    audit(user.id, 'session.created', 'user', user.id); await saveDb();
    return send(res, 200, { user: safeUser(user) }, { 'Set-Cookie': sessionCookie(token) });
  }
  if (req.method === 'POST' && pathname === '/api/auth/forgot-password') {
    if (loginLimited(`forgot:${req.socket.remoteAddress || 'unknown'}`)) return fail(res, 429, 'Too many requests. Try again in 15 minutes.');
    const body = await parseBody(req); const email = String(body.email || '').trim().toLowerCase();
    const target = db.users.find(u => u.email === email && !u.disabled);
    if (target) {
      const token = createOneTimeToken(target.id, 'reset_password', 60*60*1000);
      const url = `${APP_BASE_URL}/?resetToken=${encodeURIComponent(token)}`;
      await maybeSendEmail(target.email, 'Reset your ReLoop password', `<p>We received a request to reset your ReLoop password.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in one hour. If you did not request this, ignore this email.</p>`);
      audit(target.id, 'password.reset_requested', 'user', target.id);
      await saveDb();
    }
    return send(res, 200, { ok: true, message: 'If an account matches that address, password reset instructions will be sent.' });
  }
  if (req.method === 'POST' && pathname === '/api/auth/reset-password') {
    const body = await parseBody(req);
    if (!validString(body.token, 300) || !validString(body.password, 200) || String(body.password).length < 12) return fail(res, 400, 'Use a valid reset link and a password of at least 12 characters.');
    const target = consumeOneTimeToken(body.token, 'reset_password'); if (!target) return fail(res, 400, 'This reset link is invalid or expired. Request a new one.');
    const creds = await hashPassword(String(body.password)); target.passwordSalt = creds.salt; target.passwordHash = creds.hash; target.sessionVersion = (target.sessionVersion || 0) + 1;
    db.authTokens = db.authTokens.filter(t => t.userId !== target.id); audit(target.id, 'password.reset_completed', 'user', target.id); await saveDb();
    return send(res, 200, { ok: true, message: 'Password updated. Sign in with your new password.', }, { 'Set-Cookie': clearCookie() });
  }
  if (req.method === 'POST' && pathname === '/api/auth/resend-verification') {
    if (loginLimited(`resend:${req.socket.remoteAddress || 'unknown'}`)) return fail(res, 429, 'Too many requests. Try again in 15 minutes.');
    const body = await parseBody(req); const email = String(body.email || '').trim().toLowerCase(); const target = db.users.find(u => u.email === email && !u.disabled);
    if (target && target.emailVerified !== true) { await sendVerificationLink(target); await saveDb(); }
    return send(res, 200, { ok: true, message: 'If the account needs verification, a new email will be sent.' });
  }
  if (req.method === 'GET' && pathname === '/api/auth/verify-email') {
    const target = consumeOneTimeToken(url.searchParams.get('token'), 'verify_email');
    if (!target) return sendHtml(res, 400, '<h1>Link expired</h1><p>This verification link is invalid or expired. Request a new verification email and try again.</p>');
    target.emailVerified = true; target.emailVerifiedAt = nowIso(); audit(target.id, 'email.verified', 'user', target.id); await saveDb();
    return sendHtml(res, 200, '<h1>Email verified</h1><p>Your ReLoop email is verified. You can return to ReLoop and sign in.</p>');
  }
  if (req.method === 'POST' && pathname === '/api/integrations/kyb/webhook') {
    const raw = await parseRawBody(req);
    const webhookSecret = process.env.KYB_WEBHOOK_SECRET;
    if (!webhookSecret) return fail(res, 503, 'External business-verification webhook is not configured.');
    const supplied = String(req.headers['x-reloop-kyb-signature'] || '');
    const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest();
    let actual; try { actual = Buffer.from(supplied, 'hex'); } catch { actual = Buffer.alloc(0); }
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return fail(res, 401, 'Business-verification webhook signature is invalid.');
    let event; try { event = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'Webhook payload is invalid.'); }
    if (!validString(event.eventId, 160) || !validString(event.userId, 120) || !validString(event.provider, 80) || !['verified','rejected','pending'].includes(event.status)) return fail(res, 400, 'Provide eventId, userId, provider and a supported status.');
    if (db.kybWebhookEvents.some(e => e.eventId === event.eventId)) return send(res, 200, { ok:true, duplicate:true });
    const target = db.users.find(u => u.id === event.userId && u.role !== 'admin');
    if (!target) return fail(res, 404, 'Business account not found.');
    const previous = target.verificationStatus;
    target.verificationStatus = event.status;
    target.verificationSource = 'external_provider';
    target.verificationProvider = String(event.provider).slice(0,80);
    target.providerReference = validString(event.providerReference,200) ? event.providerReference : null;
    target.verifiedAt = event.status === 'verified' ? nowIso() : null;
    target.verificationNote = 'Status supplied by authenticated external verification provider.';
    db.kybWebhookEvents.push({ eventId:event.eventId, userId:target.id, provider:target.verificationProvider, receivedAt:nowIso() });
    if (db.kybWebhookEvents.length > 5000) db.kybWebhookEvents.splice(0, db.kybWebhookEvents.length-5000);
    audit('external-kyb-provider', 'partner.external_verification_changed', 'user', target.id, { previous, status:event.status, provider:target.verificationProvider, eventId:event.eventId });
    notify(target.id, 'Business verification updated', `Your business verification status is now ${event.status}.`, 'user', target.id);
    await saveDb(); return send(res, 200, { ok:true });
  }

  if (req.method === 'POST' && pathname === '/api/payments/webhook') {
    const raw = await parseRawBody(req);
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return fail(res, 503, 'Payment webhooks are not configured.');
    const supplied = String(req.headers['x-razorpay-signature'] || '');
    const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest();
    let actual; try { actual = Buffer.from(supplied, 'hex'); } catch { actual = Buffer.alloc(0); }
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return fail(res, 401, 'Webhook signature is invalid.');
    let event; try { event = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'Webhook payload is invalid.'); }
    const eventId = String(req.headers['x-razorpay-event-id'] || event.id || '');
    if (!eventId) return fail(res, 400, 'Webhook event ID is required for idempotency.');
    if (db.paymentWebhookEvents.some(e => e.eventId === eventId)) return send(res, 200, { ok:true, duplicate:true });
    const orderId = event?.payload?.payment?.entity?.order_id || event?.payload?.order?.entity?.id;
    const paymentId = event?.payload?.payment?.entity?.id;
    if (['payment.captured','order.paid'].includes(event.event) && orderId) {
      const payment = db.payments.find(p => p.orderId === orderId);
      if (payment) { const amount = event?.payload?.payment?.entity?.amount; const currency = event?.payload?.payment?.entity?.currency; if ((amount === undefined || Number(amount) === Number(payment.amountPaise)) && (!currency || currency === payment.currency)) { payment.paymentId = paymentId || payment.paymentId; payment.status = 'captured'; payment.capturedAt = nowIso(); audit('razorpay-webhook', 'payment.captured', 'payment', orderId, { eventId }); } }
    }
    db.paymentWebhookEvents.push({ eventId, event: event.event || 'unknown', receivedAt: nowIso() });
    if (db.paymentWebhookEvents.length > 5000) db.paymentWebhookEvents.splice(0, db.paymentWebhookEvents.length - 5000);
    await saveDb(); return send(res, 200, { ok:true });
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });

  const user = requireAuth(req, res); if (!user) return;
  if (req.method === 'POST' && pathname === '/api/issues') {
    if (loginLimited(`issue:${user.id}`)) return fail(res, 429, 'Too many issue reports. Please try again later.');
    const body = await parseBody(req);
    const allowedCategories = new Set(['Missed pickup','Incorrect weight','Pricing disagreement','Suspected fraud','Safety concern','Technical problem','Language or accessibility','Other']);
    const category = String(body.category || 'Other'); const description = String(body.description || '').trim();
    if (!allowedCategories.has(category)) return fail(res, 400, 'Choose a supported issue category.');
    if (description.length < 5 || description.length > 2000) return fail(res, 400, 'Describe the issue in 5 to 2000 characters.');
    const batchId = validString(body.batchId, 120) ? body.batchId : null;
    if (batchId) { const b = db.batches.find(x => x.id === batchId); if (!b) return fail(res, 404, 'Related material batch was not found.'); if (!canSeeBatch(user, b) && user.role !== 'admin') return fail(res, 403, 'You cannot report against this batch.'); }
    const issue = { id:id('ISS'), reporterId:user.id, reporterRole:user.role, reporterName:user.businessName || user.email, category, description, batchId, language: validString(body.language, 8) ? body.language : 'en', status:'open', createdAt:nowIso(), updatedAt:nowIso(), resolutionNote:null };
    db.issues.unshift(issue); audit(user.id, 'issue.created', 'issue', issue.id, { category, batchId });
    for (const admin of db.users.filter(u => u.role === 'admin' && !u.disabled)) notify(admin.id, 'New issue reported', `${category}: ${description.slice(0,160)}`, 'issue', issue.id);
    await saveDb(); return send(res, 201, { issue });
  }
  if (req.method === 'GET' && pathname === '/api/issues/mine') return send(res, 200, { issues: db.issues.filter(x => x.reporterId === user.id).slice(0,100) });
  if (req.method === 'GET' && pathname === '/api/admin/issues') {
    if (!requireRole(res, user, ['admin'])) return;
    return send(res, 200, { issues: db.issues.slice(0,500) });
  }
  const issueMatch = pathname.match(/^\/api\/admin\/issues\/([^/]+)$/);
  if (issueMatch && req.method === 'PATCH') {
    if (!requireRole(res, user, ['admin'])) return;
    const issue = db.issues.find(x => x.id === issueMatch[1]); if (!issue) return fail(res, 404, 'Issue report not found.');
    const body = await parseBody(req); const allowed = new Set(['open','in_review','resolved','closed']);
    if (!allowed.has(body.status)) return fail(res, 400, 'Choose a valid issue status.');
    issue.status = body.status; issue.updatedAt = nowIso();
    if (validString(body.resolutionNote, 1000)) issue.resolutionNote = body.resolutionNote.trim();
    audit(user.id, 'issue.status_changed', 'issue', issue.id, { status:issue.status });
    notify(issue.reporterId, 'Issue report updated', `Your issue ${issue.id} is now ${issue.status.replace('_',' ')}.`, 'issue', issue.id);
    await saveDb(); return send(res, 200, { issue });
  }
  if (req.method === 'GET' && pathname === '/api/auth/me') return send(res, 200, { user: safeUser(user) });
  if (req.method === 'PATCH' && pathname === '/api/profile/language') {
    const body = await parseBody(req); const language = String(body.language || '');
    if (!['en','hi','mr','gu','ta','te','kn'].includes(language)) return fail(res, 400, 'Choose a supported interface language.');
    user.language = language; user.languageUpdatedAt = nowIso(); audit(user.id, 'profile.language_changed', 'user', user.id, { language }); await saveDb();
    return send(res, 200, { language:user.language });
  }
  if (req.method === 'GET' && pathname === '/api/workspace') return send(res, 200, workspaceData(user));
  if (req.method === 'GET' && pathname === '/api/matches') {
    if (!requireRole(res, user, ['buyer'])) return;
    const filters = { category: url.searchParams.get('category') || '', q: url.searchParams.get('q') || '', minQuantity: url.searchParams.get('minQuantity') || '', maxQuantity: url.searchParams.get('maxQuantity') || '', location: url.searchParams.get('location') || '' };
    const candidates = db.batches.filter(b => b.sellerId !== user.id && ['Listed','Offer received'].includes(b.status));
    const openSearchIds = await searchOpenSearchBatchIds(filters, candidates);
    const rows = candidates.map(b => {
      const match = matchBatch(b, filters);
      const openSearchHit = openSearchIds?.has(String(b.id)) === true;
      if (openSearchIds && openSearchHit && filters.q) match.queryMatch = true;
      if (openSearchIds && openSearchHit && filters.location) match.locationMatch = true;
      return { batch: cleanBatch(b), ...match, ...(openSearchIds ? { searchEngine: 'OpenSearch' } : {}) };
    }).filter(x => x.categoryMatch && (openSearchIds ? openSearchIds.has(String(x.batch.id)) : x.queryMatch) && x.minMatch && x.maxMatch && x.locationMatch).sort((a,b) => b.score-a.score);
    return send(res, 200, { matches: rows, searchEngine: openSearchIds ? 'OpenSearch' : 'built-in', note: 'Location ranking is text-based, not a measured distance. Verify collection feasibility before making an offer.' });
  }
  if (req.method === 'POST' && pathname === '/api/batches') {
    if (!requireRole(res, user, ['generator'])) return;
    const body = await parseBody(req);
    const category = String(body.category || ''); const material = String(body.material || '').trim(); const quantity = Number(body.quantity);
    if (!MATERIALS.has(category) || !validString(material, 120) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000 || !validString(body.location, 240)) return fail(res, 400, 'Enter a supported material, positive quantity and collection location.');
    if (body.unit && !['kg','tonne','tonnes','units'].includes(body.unit)) return fail(res, 400, 'Choose a supported unit: kg, tonne or units.');
    const batch = { id: id('RL'), material, category, quantity, unit: body.unit || 'kg', condition: String(body.condition || '').slice(0, 240), location: body.location.trim(), date: nowIso(), status: 'Listed', sellerId: user.id, sellerName: user.businessName, description: String(body.description || '').slice(0, 2000), price: null, collectorId: null, collector: null, actualWeight: null, evidence: [], createdAt: nowIso(), updatedAt: nowIso() };
    db.batches.unshift(batch); audit(user.id, 'batch.listed', 'batch', batch.id, { material, quantity, unit: batch.unit });
    for (const buyer of db.users.filter(u => u.role === 'buyer' && !u.disabled)) notify(buyer.id, 'New material listed', `${user.businessName} listed ${material} (${quantity} ${batch.unit}).`, 'batch', batch.id);
    await saveDb(); return send(res, 201, { batch: cleanBatch(batch) });
  }
  if (req.method === 'GET' && pathname === '/api/batches') {
    let rows = db.batches;
    if (user.role === 'generator') rows = rows.filter(b => b.sellerId === user.id);
    else if (user.role === 'buyer') rows = rows.filter(b => !['Completed','Cancelled'].includes(b.status) && b.sellerId !== user.id);
    else if (user.role === 'collector') rows = rows.filter(b => b.collectorId === user.id);
    return send(res, 200, { batches: rows.map(cleanBatch) });
  }
  const batchMatch = pathname.match(/^\/api\/batches\/([^/]+)$/);
  if (batchMatch && req.method === 'GET') {
    const b = db.batches.find(x => x.id === batchMatch[1]);
    if (!b) return fail(res, 404, 'Batch not found.');
    if (!canSeeBatch(user, b)) return fail(res, 403, 'You do not have access to this batch.');
    return send(res, 200, { batch: cleanBatch(b), offers: db.offers.filter(o => o.batchId === b.id && (user.role === 'admin' || b.sellerId === user.id || o.buyerId === user.id)).map(o => ({ ...o, buyerName: db.users.find(u => u.id === o.buyerId)?.businessName || o.buyerName })) });
  }
  if (batchMatch && req.method === 'PATCH') {
    const body = await parseBody(req); const b = db.batches.find(x => x.id === batchMatch[1]);
    if (!b) return fail(res, 404, 'Batch not found.');
    if (user.role === 'generator' && b.sellerId !== user.id) return fail(res, 403, 'You can only update your own listings.');
    if (user.role === 'buyer') return fail(res, 403, 'Buyers change commercial terms through offers.');
    if (user.role === 'collector' && b.collectorId !== user.id) return fail(res, 403, 'This pickup is not assigned to your account.');
    const oldStatus = b.status;
    if (body.status && !BATCH_STATES.has(body.status)) return fail(res, 400, 'Unsupported transaction status.');
    if (body.status && user.role === 'generator' && !['Cancelled','Listed'].includes(body.status)) return fail(res, 403, 'Businesses may cancel a pre-collection listing; collection states are recorded by the assigned operator.');
    if (user.role === 'generator' && body.status === 'Cancelled' && !['Listed','Offer received','Offer accepted'].includes(oldStatus)) return fail(res, 409, 'This batch can no longer be cancelled from the business workspace. Contact support to resolve an exception.');
    if (user.role === 'generator' && body.status === 'Listed' && oldStatus !== 'Listed') return fail(res, 409, 'A transaction cannot be relisted after its status has advanced.');
    if (body.status && user.role === 'collector' && !((oldStatus === 'Collection scheduled' && body.status === 'Collected') || (oldStatus === 'Collected' && body.status === 'Completed'))) return fail(res, 409, 'That status transition is not allowed for this pickup.');
    if (body.status === 'Completed') {
      const weight = Number(body.actualWeight);
      if (!Number.isFinite(weight) || weight <= 0) return fail(res, 400, 'Record a positive actual weight before completing the handover.');
      if (!Array.isArray(b.evidence) || b.evidence.length === 0) return fail(res, 400, 'Upload handover evidence before completing the transaction.');
      b.actualWeight = weight;
    }
    if (body.status) b.status = body.status;
    if (body.status === 'Cancelled') for (const offer of db.offers.filter(o=>o.batchId===b.id&&o.status==='Pending')) { offer.status='Declined'; offer.updatedAt=nowIso(); notify(offer.buyerId,'Listing cancelled',`Batch ${b.id} was cancelled by the material owner.`,'batch',b.id); }
    if (body.status === 'Collected') b.collectedAt = nowIso();
    if (body.status === 'Completed') b.completedAt = nowIso();
    if (body.status === 'Cancelled') b.cancelledAt = nowIso();
    if (user.role === 'admin' && body.collectorId) {
      const collector = db.users.find(u => u.id === body.collectorId && u.role === 'collector');
      if (!collector) return fail(res, 400, 'Choose a registered collector account.');
      b.collectorId = collector.id; b.collector = collector.businessName; b.status = 'Collection scheduled';
      notify(collector.id, 'Pickup assigned', `Batch ${b.id} (${b.material}) has been assigned to your account.`, 'batch', b.id);
      notify(b.sellerId, 'Collector assigned', `${collector.businessName} was assigned to batch ${b.id}.`, 'batch', b.id);
    }
    b.updatedAt = nowIso(); audit(user.id, 'batch.updated', 'batch', b.id, { from: oldStatus, to: b.status, changedFields: Object.keys(body) });
    for (const recipient of [b.sellerId, b.collectorId, ...db.offers.filter(o => o.batchId === b.id && o.status === 'Accepted').map(o => o.buyerId)]) if (recipient && recipient !== user.id) notify(recipient, 'Transaction updated', `Batch ${b.id} is now ${b.status}.`, 'batch', b.id);
    await saveDb(); return send(res, 200, { batch: cleanBatch(b) });
  }
  const offerBatchMatch = pathname.match(/^\/api\/batches\/([^/]+)\/offers$/);
  if (offerBatchMatch && req.method === 'POST') {
    if (!requireRole(res, user, ['buyer'])) return;
    const b = db.batches.find(x => x.id === offerBatchMatch[1]); if (!b) return fail(res, 404, 'Batch not found.');
    if (b.sellerId === user.id || !['Listed','Offer received'].includes(b.status)) return fail(res, 409, 'This batch is not available for a new offer.');
    const body = await parseBody(req); const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000000) return fail(res, 400, 'Enter a positive offer rate.');
    if (db.offers.some(o => o.batchId === b.id && o.buyerId === user.id && o.status === 'Pending')) return fail(res, 409, 'You already have a pending offer for this batch.');
    const offer = { id: id('OF'), batchId: b.id, buyerId: user.id, buyerName: user.businessName, price, unit: b.unit, pickup: String(body.pickup || 'To be agreed').slice(0, 120), note: String(body.note || '').slice(0, 1000), status: 'Pending', createdAt: nowIso(), updatedAt: nowIso() };
    db.offers.unshift(offer); b.status = 'Offer received'; b.updatedAt = nowIso();
    notify(b.sellerId, 'Offer received', `${user.businessName} offered ₹${price.toFixed(2)} per ${b.unit} for ${b.id}.`, 'offer', offer.id);
    audit(user.id, 'offer.created', 'offer', offer.id, { batchId: b.id, price }); await saveDb();
    maybeSendEmail(db.users.find(u => u.id === b.sellerId)?.email, 'ReLoop: new material offer', `<p>${escapeHtml(user.businessName)} submitted an offer for ${escapeHtml(b.material)}.</p><p>Rate: ₹${price.toFixed(2)} per ${escapeHtml(b.unit)}.</p>`);
    return send(res, 201, { offer });
  }
  const offerMatch = pathname.match(/^\/api\/offers\/([^/]+)$/);
  if (offerMatch && req.method === 'PATCH') {
    const body = await parseBody(req); const o = db.offers.find(x => x.id === offerMatch[1]); if (!o) return fail(res, 404, 'Offer not found.');
    const b = db.batches.find(x => x.id === o.batchId); if (!b) return fail(res, 404, 'Batch not found.');
    if (user.role !== 'admin' && b.sellerId !== user.id) return fail(res, 403, 'Only the material owner can accept or decline an offer.');
    if (!['Accepted','Declined'].includes(body.status) || o.status !== 'Pending') return fail(res, 409, 'This offer can no longer be changed.');
    if (!['Listed','Offer received'].includes(b.status)) return fail(res, 409, 'This batch is no longer accepting offer decisions.');
    if (body.status === 'Accepted') {
      for (const other of db.offers.filter(x => x.batchId === b.id && x.id !== o.id && x.status === 'Pending')) { other.status = 'Declined'; other.updatedAt = nowIso(); notify(other.buyerId, 'Offer not selected', `Another offer was selected for batch ${b.id}.`, 'offer', other.id); }
      o.status = 'Accepted'; b.price = o.price; b.acceptedOfferId = o.id; b.status = 'Offer accepted'; b.updatedAt = nowIso();
      notify(o.buyerId, 'Offer accepted', `${db.users.find(u=>u.id===b.sellerId)?.businessName || 'The business'} accepted your offer for ${b.id}.`, 'offer', o.id);
      notify(b.sellerId, 'Offer accepted', `You accepted the offer for ${b.id}. Assign a collector to schedule pickup.`, 'offer', o.id);
    } else { o.status = 'Declined'; o.updatedAt = nowIso(); }
    audit(user.id, `offer.${o.status.toLowerCase()}`, 'offer', o.id, { batchId: b.id }); await saveDb();
    maybeSendEmail(db.users.find(u => u.id === o.buyerId)?.email, `ReLoop: offer ${o.status.toLowerCase()}`, `<p>Your offer for ${escapeHtml(b.material)} (${escapeHtml(b.id)}) was ${escapeHtml(o.status.toLowerCase())}.</p>`);
    return send(res, 200, { offer: o, batch: cleanBatch(b) });
  }
  if (req.method === 'GET' && pathname === '/api/notifications') return send(res, 200, { notifications: db.notifications.filter(n => n.userId === user.id).slice(0, 100) });
  const notificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (notificationMatch && req.method === 'POST') {
    const n = db.notifications.find(x => x.id === notificationMatch[1] && x.userId === user.id);
    if (!n) return fail(res, 404, 'Notification not found.'); n.readAt = nowIso(); await saveDb(); return send(res, 200, { notification: n });
  }
  const evidenceMatch = pathname.match(/^\/api\/batches\/([^/]+)\/evidence$/);
  if (evidenceMatch && req.method === 'POST') {
    const b = db.batches.find(x => x.id === evidenceMatch[1]); if (!b) return fail(res, 404, 'Batch not found.');
    if (!canParticipateInBatch(user, b)) return fail(res, 403, 'You cannot attach evidence to this batch.');
    const body = await parseBody(req); const allowed = new Set(['image/jpeg','image/png','application/pdf']);
    if (!allowed.has(body.contentType) || !validString(body.filename, 160) || !validString(body.dataBase64, 9 * 1024 * 1024)) return fail(res, 400, 'Upload a JPG, PNG or PDF evidence file.');
    const base64 = body.dataBase64.replace(/^data:[^;]+;base64,/, ''); const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length || buffer.length > 6 * 1024 * 1024) return fail(res, 413, 'Evidence files must be smaller than 6 MB.');
    if (!fileSignatureMatches(buffer, body.contentType)) return fail(res, 400, 'The file contents do not match the selected file type.');
    const fileId = crypto.randomUUID(); let storage;
    try { storage = await storeEvidence(buffer, { fileId, contentType: body.contentType, ownerId: user.id, kind: 'handover' }); }
    catch (error) { console.error('Evidence storage failed', { provider: 's3', name: error?.name || 'Error' }); return fail(res, 503, 'Evidence storage is temporarily unavailable. Please retry.'); }
    const evidence = { id: fileId, filename: path.basename(body.filename).slice(0, 160), contentType: body.contentType, size: buffer.length, uploadedBy: user.id, createdAt: nowIso(), ...storage };
    b.evidence = Array.isArray(b.evidence) ? b.evidence : []; b.evidence.push(evidence); b.updatedAt = nowIso(); audit(user.id, 'evidence.uploaded', 'batch', b.id, { evidenceId: fileId, contentType: body.contentType, size: buffer.length, storage: storage.storage }); await saveDb();
    const { storageKey: _storageKey, ...publicEvidence } = evidence;
    return send(res, 201, { evidence: publicEvidence });
  }
  const evidenceFileMatch = pathname.match(/^\/api\/evidence\/([a-f0-9-]+)$/i);
  if (evidenceFileMatch && req.method === 'GET') {
    const evidence = db.batches.flatMap(b => b.evidence || []).find(e => e.id === evidenceFileMatch[1]);
    const owningBatch = db.batches.find(b => (b.evidence || []).some(e => e.id === evidenceFileMatch[1]));
    if (!evidence || !owningBatch || !canParticipateInBatch(user, owningBatch)) return fail(res, 404, 'Evidence not found.');
    let fileBuffer;
    try { fileBuffer = await readEvidence(evidence); } catch { return fail(res, 404, 'Evidence file is no longer available.'); }
    res.writeHead(200, { 'Content-Type': evidence.contentType, 'Content-Length': fileBuffer.length, 'Content-Disposition': `attachment; filename="${path.basename(evidence.filename).replace(/["\\\r\n]/g, '_')}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }); return res.end(fileBuffer);
  }
  if (req.method === 'GET' && pathname === '/api/verification/evidence') {
    return send(res, 200, { evidence: (user.verificationEvidence || []).map(e => ({ id:e.id, filename:e.filename, contentType:e.contentType, size:e.size, documentType:e.documentType, createdAt:e.createdAt })) });
  }
  if (req.method === 'POST' && pathname === '/api/verification/evidence') {
    if (!requireRole(res, user, ['generator','buyer','collector'])) return;
    const body = await parseBody(req); const allowed = new Set(['image/jpeg','image/png','application/pdf']); const typesByRole = { generator:new Set(['business_registration','tax_document','address_proof','material_source_proof','other']), buyer:new Set(['business_registration','tax_document','address_proof','buyer_authorization','processing_capability','other']), collector:new Set(['identity_proof','address_proof','vehicle_document','transport_permit','other']) }; const types = typesByRole[user.role] || new Set(['other']);
    if (!allowed.has(body.contentType) || !validString(body.filename, 160) || !validString(body.dataBase64, 9 * 1024 * 1024) || !types.has(body.documentType)) return fail(res, 400, 'Choose a document type appropriate for your role and upload a JPG, PNG or PDF.');
    const buffer = Buffer.from(body.dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64'); if (!buffer.length || buffer.length > 6 * 1024 * 1024) return fail(res, 413, 'Verification documents must be smaller than 6 MB.'); if (!fileSignatureMatches(buffer, body.contentType)) return fail(res, 400, 'The file contents do not match the selected file type.');
    const fileId = crypto.randomUUID(); let storage;
    try { storage = await storeEvidence(buffer, { fileId, contentType: body.contentType, ownerId: user.id, kind: 'verification' }); }
    catch (error) { console.error('Verification storage failed', { provider: 's3', name: error?.name || 'Error' }); return fail(res, 503, 'Document storage is temporarily unavailable. Please retry.'); }
    const evidence = { id:fileId, filename:path.basename(body.filename).slice(0,160), contentType:body.contentType, size:buffer.length, documentType:body.documentType, uploadedBy:user.id, createdAt:nowIso(), ...storage };
    user.verificationEvidence = Array.isArray(user.verificationEvidence) ? user.verificationEvidence : []; user.verificationEvidence.push(evidence); if (user.verificationStatus !== 'verified') user.verificationStatus = 'pending'; audit(user.id, 'verification_document.uploaded', 'user', user.id, { evidenceId:fileId, documentType:body.documentType });
    for (const admin of db.users.filter(u=>u.role==='admin'&&!u.disabled)) notify(admin.id, 'Verification documents submitted', `${user.businessName} submitted ${body.documentType.replaceAll('_',' ')} for review.`, 'user', user.id);
    await saveDb(); return send(res, 201, { evidence:{ id:evidence.id, filename:evidence.filename, contentType:evidence.contentType, size:evidence.size, documentType:evidence.documentType, createdAt:evidence.createdAt } });
  }
  const adminEvidenceMatch = pathname.match(/^\/api\/admin\/partners\/([^/]+)\/evidence\/([a-f0-9-]+)$/i);
  if (adminEvidenceMatch && req.method === 'GET') {
    if (!requireRole(res, user, ['admin'])) return;
    const target = db.users.find(u=>u.id===adminEvidenceMatch[1]); const evidence = target && (target.verificationEvidence||[]).find(e=>e.id===adminEvidenceMatch[2]);
    if (!evidence) return fail(res, 404, 'Verification document not found.');
    let fileBuffer;
    try { fileBuffer = await readEvidence(evidence); } catch { return fail(res, 404, 'Verification document file is unavailable.'); }
    res.writeHead(200, { 'Content-Type': evidence.contentType, 'Content-Length': fileBuffer.length, 'Content-Disposition': `attachment; filename="${path.basename(evidence.filename).replace(/["\\\r\n]/g, '_')}"`, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'private, no-store' }); return res.end(fileBuffer);
  }
  if (req.method === 'GET' && pathname === '/api/admin/partners') {
    if (!requireRole(res, user, ['admin'])) return;
    return send(res, 200, { partners: db.users.map(u => ({ ...safeUser(u), verificationEvidence: (u.verificationEvidence || []).map(e => ({ id:e.id, filename:e.filename, contentType:e.contentType, size:e.size, documentType:e.documentType, createdAt:e.createdAt })) })) });
  }
  const verifyPartnerMatch = pathname.match(/^\/api\/admin\/partners\/([^/]+)\/verification$/);
  if (verifyPartnerMatch && req.method === 'PATCH') {
    if (!requireRole(res, user, ['admin'])) return;
    const target = db.users.find(u => u.id === verifyPartnerMatch[1]); if (!target) return fail(res, 404, 'Partner not found.');
    const body = await parseBody(req); if (!['verified','rejected','pending'].includes(body.status)) return fail(res, 400, 'Choose verified, rejected or pending.');
    if (body.status === 'verified') { const cfg = ROLE_VERIFICATION[target.role]; const docs = target.verificationEvidence || []; const relevant = cfg ? [...cfg.organizationDocs, ...cfg.roleDocs] : []; if (!docs.some(d => relevant.includes(d.documentType))) return fail(res, 409, 'Review at least one document relevant to this partner role before marking the account verified.'); }
    const previous = target.verificationStatus; target.verificationStatus = body.status; target.verificationNote = String(body.note || '').slice(0, 1000); target.verifiedAt = body.status === 'verified' ? nowIso() : null; target.verifiedBy = user.id;
    audit(user.id, 'partner.verification_changed', 'user', target.id, { previous, status: target.verificationStatus }); notify(target.id, 'Business verification updated', `Your profile status is now ${target.verificationStatus}.`, 'user', target.id); await saveDb(); return send(res, 200, { user: safeUser(target) });
  }
  if (req.method === 'GET' && pathname === '/api/admin/audit') {
    if (!requireRole(res, user, ['admin'])) return;
    return send(res, 200, { audit: db.audit.slice(0, 500) });
  }
  const assignMatch = pathname.match(/^\/api\/admin\/batches\/([^/]+)\/assign-collector$/);
  if (assignMatch && req.method === 'PATCH') {
    if (!requireRole(res, user, ['admin'])) return;
    const body = await parseBody(req); const b = db.batches.find(x => x.id === assignMatch[1]); if (!b) return fail(res, 404, 'Batch not found.');
    const collector = db.users.find(u => u.id === body.collectorId && u.role === 'collector' && !u.disabled); if (!collector) return fail(res, 400, 'Choose an active collector account.');
    if (!['Offer accepted','Collection scheduled'].includes(b.status)) return fail(res, 409, 'A collector can only be assigned after an offer has been accepted.');
    b.collectorId = collector.id; b.collector = collector.businessName; b.status = 'Collection scheduled'; b.updatedAt = nowIso(); notify(collector.id, 'Pickup assigned', `${b.material} (${b.id}) has been assigned to you.`, 'batch', b.id); notify(b.sellerId, 'Pickup scheduled', `${collector.businessName} is assigned to ${b.id}.`, 'batch', b.id); audit(user.id, 'collector.assigned', 'batch', b.id, { collectorId: collector.id }); await saveDb(); return send(res, 200, { batch: cleanBatch(b) });
  }
  if (req.method === 'POST' && pathname === '/api/payments/order') {
    const body = await parseBody(req); const batch = db.batches.find(b => b.id === body.batchId); const acceptedOffer = batch && db.offers.find(o => o.id === batch.acceptedOfferId && o.status === 'Accepted');
    const paymentParty = batch && (batch.sellerId === user.id || batch.collectorId === user.id || acceptedOffer?.buyerId === user.id);
    if (!batch || batch.status !== 'Completed' || !paymentParty) return fail(res, 403, 'A platform-fee order can only be created by a transaction party after a completed transaction.');
    const amountPaise = Number(process.env.RELOOP_PLATFORM_FEE_PAISE || 0);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100 || amountPaise > 50000000) return fail(res, 503, 'Platform-fee payments are disabled until ReLoop configures an approved fee amount and merchant policy.');
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return fail(res, 503, 'Payments are not enabled. Configure a verified Razorpay merchant account and server-side API keys first.');
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: id('RCP'), notes: { userId: user.id, batchId: batch.id, purpose: 'ReLoop platform fee' } }) });
    const order = await orderResponse.json(); if (!orderResponse.ok) return fail(res, 502, 'Payment provider could not create an order. Check merchant configuration.');
    db.payments.push({ id: id('PAY'), userId: user.id, batchId: batch.id, orderId: order.id, amountPaise, currency: 'INR', status: 'created', createdAt: nowIso() }); audit(user.id, 'payment.order_created', 'payment', order.id, { batchId: batch.id, amountPaise }); await saveDb(); return send(res, 201, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  }
  if (req.method === 'POST' && pathname === '/api/payments/verify') {
    const body = await parseBody(req); if (!process.env.RAZORPAY_KEY_SECRET) return fail(res, 503, 'Payments are not enabled.');
    if (!validString(body.orderId, 100) || !validString(body.paymentId, 100) || !validString(body.signature, 300)) return fail(res, 400, 'Payment verification details are incomplete.');
    const payment = db.payments.find(p => p.orderId === body.orderId && p.userId === user.id); if (!payment) return fail(res, 404, 'Payment order not found for this account.');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${body.orderId}|${body.paymentId}`).digest(); const supplied = Buffer.from(body.signature, 'hex');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return fail(res, 400, 'Payment signature verification failed.');
    payment.paymentId = body.paymentId; payment.status = 'signature_verified'; payment.verifiedAt = nowIso(); audit(user.id, 'payment.signature_verified', 'payment', payment.orderId); await saveDb(); return send(res, 200, { ok: true, status: payment.status, note: 'Signature verified. For high-assurance settlement, reconcile with provider webhooks/API before marking funds settled.' });
  }
  return fail(res, 404, 'API route not found.');
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Production must never silently fall back to local JSON or an ephemeral session secret.
if (NODE_ENV === 'production') {
  if (!USE_POSTGRES) throw new Error('Production startup requires DATABASE_URL (PostgreSQL).');
  if (!process.env.RELOOP_SESSION_SECRET || process.env.RELOOP_SESSION_SECRET.length < 64) throw new Error('Production requires a strong RELOOP_SESSION_SECRET of at least 64 characters.');
  if (!process.env.APP_BASE_URL || !process.env.APP_BASE_URL.startsWith('https://')) throw new Error('Production requires APP_BASE_URL to use HTTPS.');
  if (!process.env.RESEND_API_KEY || !process.env.RELOOP_FROM_EMAIL) throw new Error('Production email verification requires RESEND_API_KEY and RELOOP_FROM_EMAIL.');
  if (!process.env.RELOOP_ADMIN_EMAIL || !process.env.RELOOP_ADMIN_PASSWORD || process.env.RELOOP_ADMIN_PASSWORD.length < 16) throw new Error('Production requires a configured bootstrap admin email and password of at least 16 characters.');
  if (!process.env.KYB_WEBHOOK_SECRET || process.env.KYB_WEBHOOK_SECRET.length < 32) throw new Error('Production requires KYB_WEBHOOK_SECRET to authenticate external verification callbacks.');
  const paymentSettings = [process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET, process.env.RAZORPAY_WEBHOOK_SECRET, process.env.RELOOP_PLATFORM_FEE_PAISE];
  if (paymentSettings.some(Boolean) && !paymentSettings.every(Boolean)) throw new Error('Payments require Razorpay API keys, webhook secret and approved platform fee to be configured together.');
  if (!process.env.RAZORPAY_WEBHOOK_SECRET && process.env.RAZORPAY_KEY_ID) console.warn('Razorpay keys are configured without a webhook secret; captured status cannot be reconciled from webhooks.');
}
await initPostgres();
for (const existingAdmin of db.users.filter(u => u.role === 'admin')) { existingAdmin.emailVerified = true; existingAdmin.sessionVersion = existingAdmin.sessionVersion || 0; }

// Optional first admin account. It is never available through public registration.
if (process.env.RELOOP_ADMIN_EMAIL && process.env.RELOOP_ADMIN_PASSWORD && !db.users.some(u => u.email === process.env.RELOOP_ADMIN_EMAIL.toLowerCase())) {
  const creds = await hashPassword(process.env.RELOOP_ADMIN_PASSWORD);
  db.users.push({ id: id('USR'), email: process.env.RELOOP_ADMIN_EMAIL.toLowerCase(), businessName: process.env.RELOOP_ADMIN_NAME || 'ReLoop Operations', role: 'admin', passwordSalt: creds.salt, passwordHash: creds.hash, emailVerified: true, sessionVersion: 0, verificationStatus: 'verified', createdAt: nowIso(), disabled: false });
  await saveDb();
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const origin = req.headers.origin;
  const allowed = new Set(['http://localhost:5173','http://127.0.0.1:5173',`http://localhost:${PORT}`,`http://127.0.0.1:${PORT}`,...String(process.env.RELOOP_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)]);
  if (origin && allowed.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (NODE_ENV === 'production' && req.url?.startsWith('/api/') && ['POST','PATCH','PUT','DELETE'].includes(req.method) && origin && !allowed.has(origin)) return fail(res, 403, 'Origin is not allowed.');
  if (!req.url?.startsWith('/api/')) {
    const dist = path.join(ROOT, 'dist');
    if (fs.existsSync(path.join(dist, 'index.html')) && ['GET','HEAD'].includes(req.method)) {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const candidate = path.resolve(dist, `.${urlPath}`);
      const file = candidate.startsWith(dist + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(dist, 'index.html');
      const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable' });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('ReLoop API is running. Build the frontend with npm run build.');
  }
  const run = pgPool ? pgQueue.then(() => withStoreRequest(req, res)) : (async()=>{ try { await route(req,res); } catch(err) { console.error('Request error:',err); if(!res.headersSent) send(res,err.status||500,{error:err.status?err.message:'Unexpected server error. Check server logs.'}); else if(!res.writableEnded) res.end(); } })();
  if (pgPool) pgQueue = run.catch(()=>{});
  await run;
});
server.listen(PORT, '0.0.0.0', () => console.log(`ReLoop API listening on port ${PORT} (${NODE_ENV}; persistence=${pgPool?'postgresql':'local-json'})`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async()=>{ server.close(); if(pgPool) await pgPool.end().catch(()=>{}); process.exit(0); });

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reloop-api-test-'));
const port = 34127 + Math.floor(Math.random() * 5000);
const base = `http://127.0.0.1:${port}`;
let server;
let generatorCookie, buyerCookie, collectorCookie, adminCookie;
let batchId, offerId, collectorId;
async function request(route, { method='GET', body, cookie }={}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  const setCookie = response.headers.get('set-cookie');
  return { status: response.status, data, cookie: setCookie ? setCookie.split(';')[0] : undefined };
}
async function register(role, suffix) {
  const result = await request('/api/auth/register', { method:'POST', body:{ businessName:`Test ${role}`, email:`${role}-${suffix}@example.test`, password:'Test-password-2026!', role } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return { user:result.data.user, cookie:result.cookie };
}
async function waitForServer() {
  for (let i=0;i<100;i++) { try { const r=await fetch(`${base}/api/health`); if(r.ok)return; } catch {} await new Promise(r=>setTimeout(r,100)); }
  throw new Error('ReLoop API did not start');
}

server = spawn(process.execPath, ['server/server.mjs'], { cwd:root, env:{...process.env, API_PORT:String(port), RELOOP_DATA_DIR:tempDir, RELOOP_SESSION_SECRET:'test-secret-that-is-long-enough-for-local-tests', RELOOP_ADMIN_EMAIL:'admin@example.test', RELOOP_ADMIN_PASSWORD:'Admin-test-password-2026!', RELOOP_ADMIN_NAME:'Test Admin', KYB_WEBHOOK_SECRET:'test-kyb-webhook-secret-2026', RAZORPAY_WEBHOOK_SECRET:'test-razorpay-webhook-secret-2026' }, stdio:'ignore' });
await waitForServer();

test('health endpoint is available', async()=>{
  const r=await request('/api/health'); assert.equal(r.status,200); assert.equal(r.data.status,'ok');
});
test('accounts register and role cannot self-assign admin', async()=>{
  const gen=await register('generator','a'); generatorCookie=gen.cookie;
  const buy=await register('buyer','a'); buyerCookie=buy.cookie;
  const col=await register('collector','a'); collectorCookie=col.cookie; collectorId=col.user.id;
  assert.deepEqual(gen.user.verificationChecks.map(c=>c.key),['contact','organization','role']);
  assert.equal(gen.user.verificationChecks[2].label,'Material-source profile');
  assert.equal(buy.user.verificationChecks[2].label,'Buyer capability');
  assert.equal(col.user.verificationChecks[2].label,'Collection capability');
  const bad=await request('/api/auth/register',{method:'POST',body:{businessName:'Bad Admin',email:'badadmin@example.test',password:'Test-password-2026!',role:'admin'}});
  assert.equal(bad.status,400);
  const duplicate=await request('/api/auth/register',{method:'POST',body:{businessName:'Duplicate Generator',email:'generator-a@example.test',password:'Test-password-2026!',role:'generator'}});
  assert.equal(duplicate.status,409); assert.match(duplicate.data.error,/account with this email already exists/i);
  const wrongWorkspace=await request('/api/auth/login',{method:'POST',body:{email:'buyer-a@example.test',password:'Test-password-2026!',expectedRole:'generator'}});
  assert.equal(wrongWorkspace.status,403); assert.match(wrongWorkspace.data.error,/registered as Buyer \/ recycler/i);
  const correctWorkspace=await request('/api/auth/login',{method:'POST',body:{email:'buyer-a@example.test',password:'Test-password-2026!',expectedRole:'buyer'}});
  assert.equal(correctWorkspace.status,200); assert.equal(correctWorkspace.data.user.role,'buyer');
  const adminLogin=await request('/api/auth/login',{method:'POST',body:{email:'admin@example.test',password:'Admin-test-password-2026!',expectedRole:'admin'}});
  assert.equal(adminLogin.status,200); assert.equal(adminLogin.data.user.role,'admin');
  const wrongAdminRole=await request('/api/auth/login',{method:'POST',body:{email:'admin@example.test',password:'Admin-test-password-2026!',expectedRole:'buyer'}});
  assert.equal(wrongAdminRole.status,403);
});
test('material listing is stored and matched to buyer filters', async()=>{
  const created=await request('/api/batches',{method:'POST',cookie:generatorCookie,body:{material:'Corrugated cardboard',category:'Cardboard',quantity:80,unit:'kg',condition:'Clean and dry',location:'Baner, Pune',description:'Test batch'}});
  assert.equal(created.status,201,JSON.stringify(created.data)); batchId=created.data.batch.id;
  const matches=await request('/api/matches?category=Cardboard&minQuantity=50&location=Baner%2C%20Pune',{cookie:buyerCookie});
  assert.equal(matches.status,200); assert.equal(matches.data.matches.length,1); assert.equal(matches.data.matches[0].batch.id,batchId);
});
test('buyer offer is visible to seller and acceptance updates shared transaction', async()=>{
  const offered=await request(`/api/batches/${batchId}/offers`,{method:'POST',cookie:buyerCookie,body:{price:12.5,note:'Pickup within 24 hours'}});
  assert.equal(offered.status,201,JSON.stringify(offered.data)); offerId=offered.data.offer.id;
  const wrongRole=await request(`/api/batches/${batchId}`,{method:'PATCH',cookie:buyerCookie,body:{status:'Completed'}}); assert.equal(wrongRole.status,403);
  const accepted=await request(`/api/offers/${offerId}`,{method:'PATCH',cookie:generatorCookie,body:{status:'Accepted'}});
  assert.equal(accepted.status,200); assert.equal(accepted.data.batch.status,'Offer accepted');
});
test('admin assigns collector; collector must upload evidence before completion', async()=>{
  const login=await request('/api/auth/login',{method:'POST',body:{email:'admin@example.test',password:'Admin-test-password-2026!'}}); assert.equal(login.status,200); adminCookie=login.cookie;
  const assigned=await request(`/api/admin/batches/${batchId}/assign-collector`,{method:'PATCH',cookie:adminCookie,body:{collectorId}});
  assert.equal(assigned.status,200); assert.equal(assigned.data.batch.status,'Collection scheduled');
  const colWorkspace=await request('/api/workspace',{cookie:collectorCookie}); assert.equal(colWorkspace.status,200); assert.ok(colWorkspace.data.batches.some(b=>b.id===batchId));
  const collected=await request(`/api/batches/${batchId}`,{method:'PATCH',cookie:collectorCookie,body:{status:'Collected'}}); assert.equal(collected.status,200);
  const noEvidence=await request(`/api/batches/${batchId}`,{method:'PATCH',cookie:collectorCookie,body:{status:'Completed',actualWeight:78}}); assert.equal(noEvidence.status,400);
  const upload=await request(`/api/batches/${batchId}/evidence`,{method:'POST',cookie:collectorCookie,body:{filename:'handover.pdf',contentType:'application/pdf',dataBase64:Buffer.from('%PDF-1.4\nTest evidence\n%%EOF').toString('base64')}}); assert.equal(upload.status,201);
  const complete=await request(`/api/batches/${batchId}`,{method:'PATCH',cookie:collectorCookie,body:{status:'Completed',actualWeight:78}}); assert.equal(complete.status,200); assert.equal(complete.data.batch.actualWeight,78);
});
test('admin verification and audit records are protected and functional', async()=>{
  const partners=await request('/api/admin/partners',{cookie:adminCookie}); assert.equal(partners.status,200);
  const gen=partners.data.partners.find(p=>p.role==='generator');
  const denied=await request(`/api/admin/partners/${gen.id}/verification`,{method:'PATCH',cookie:adminCookie,body:{status:'verified',note:'Must require documents'}}); assert.equal(denied.status,409);
  const pdf = Buffer.from('%PDF-1.4\nTest evidence\n%%EOF').toString('base64');
  const buyerWrongDoc=await request('/api/verification/evidence',{method:'POST',cookie:buyerCookie,body:{filename:'source-proof.pdf',contentType:'application/pdf',documentType:'material_source_proof',dataBase64:pdf}}); assert.equal(buyerWrongDoc.status,400);
  const buyerDoc=await request('/api/verification/evidence',{method:'POST',cookie:buyerCookie,body:{filename:'buyer-authorization.pdf',contentType:'application/pdf',documentType:'buyer_authorization',dataBase64:pdf}}); assert.equal(buyerDoc.status,201);
  const collectorDoc=await request('/api/verification/evidence',{method:'POST',cookie:collectorCookie,body:{filename:'vehicle-document.pdf',contentType:'application/pdf',documentType:'vehicle_document',dataBase64:pdf}}); assert.equal(collectorDoc.status,201);
  const doc=await request('/api/verification/evidence',{method:'POST',cookie:generatorCookie,body:{filename:'business-registration.pdf',contentType:'application/pdf',documentType:'business_registration',dataBase64:Buffer.from('%PDF-1.4\nTest business document\n%%EOF').toString('base64')}}); assert.equal(doc.status,201);
  const genWorkspace=await request('/api/workspace',{cookie:generatorCookie}); assert.equal(genWorkspace.data.user.verificationChecks.find(c=>c.key==='organization').status,'in_review');
  const buyerWorkspace=await request('/api/workspace',{cookie:buyerCookie}); assert.equal(buyerWorkspace.data.user.verificationChecks.find(c=>c.key==='role').status,'in_review');
  const refreshed=await request('/api/admin/partners',{cookie:adminCookie}); const genWithDoc=refreshed.data.partners.find(p=>p.id===gen.id); assert.equal(genWithDoc.verificationEvidence.length,1);
  const verified=await request(`/api/admin/partners/${gen.id}/verification`,{method:'PATCH',cookie:adminCookie,body:{status:'verified',note:'Test verification'}}); assert.equal(verified.status,200); assert.equal(verified.data.user.verificationStatus,'verified'); assert.ok(verified.data.user.verificationChecks.every(c=>c.status==='verified'));
  const download=await fetch(`${base}/api/admin/partners/${gen.id}/evidence/${doc.data.evidence.id}`,{headers:{Cookie:adminCookie}}); assert.equal(download.status,200);
  const audit=await request('/api/admin/audit',{cookie:adminCookie}); assert.equal(audit.status,200); assert.ok(audit.data.audit.length>=5);
  const forbidden=await request('/api/admin/partners',{cookie:buyerCookie}); assert.equal(forbidden.status,403);
});
test('session logout clears session cookie', async()=>{
  const out=await request('/api/auth/logout',{method:'POST',cookie:generatorCookie}); assert.equal(out.status,200); assert.ok(out.cookie.includes('reloop_session='));
});


test('account recovery returns a non-enumerating response and rejects invalid reset tokens', async()=>{
  const forgot=await request('/api/auth/forgot-password',{method:'POST',body:{email:'unknown@example.test'}});
  assert.equal(forgot.status,200); assert.match(forgot.data.message,/If an account matches/i);
  const reset=await request('/api/auth/reset-password',{method:'POST',body:{token:'not-a-real-token',password:'A-strong-new-password-2026!'}});
  assert.equal(reset.status,400);
});
test('interface language preference is validated and saved to the account', async()=>{
  const saved=await request('/api/profile/language',{method:'PATCH',cookie:buyerCookie,body:{language:'mr'}}); assert.equal(saved.status,200); assert.equal(saved.data.language,'mr');
  const me=await request('/api/auth/me',{cookie:buyerCookie}); assert.equal(me.status,200); assert.equal(me.data.user.language,'mr');
  const bad=await request('/api/profile/language',{method:'PATCH',cookie:buyerCookie,body:{language:'xx'}}); assert.equal(bad.status,400);
});

test('external verification webhook requires a valid signature and is idempotent', async()=>{
  const partners=await request('/api/admin/partners',{cookie:adminCookie});
  const target=partners.data.partners.find(p=>p.role==='generator'); assert.ok(target);
  const payload={eventId:'kyb-event-test-001',userId:target.id,provider:'TestProvider',providerReference:'case-123',status:'verified'};
  const raw=JSON.stringify(payload); const signature=crypto.createHmac('sha256','test-kyb-webhook-secret-2026').update(raw).digest('hex');
  const sendWebhook=()=>fetch(`${base}/api/integrations/kyb/webhook`,{method:'POST',headers:{'Content-Type':'application/json','x-reloop-kyb-signature':signature},body:raw});
  const first=await sendWebhook(); assert.equal(first.status,200);
  const second=await sendWebhook(); assert.equal(second.status,200); const duplicate=await second.json(); assert.equal(duplicate.duplicate,true);
  const refreshed=await request('/api/admin/partners',{cookie:adminCookie});
  assert.equal(refreshed.data.partners.find(p=>p.id===target.id).verificationStatus,'verified');
});
test('payment webhook rejects invalid signatures', async()=>{
  const response=await fetch(`${base}/api/payments/webhook`,{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':'bad','x-razorpay-event-id':'bad-event'},body:JSON.stringify({event:'payment.captured'})});
  assert.equal(response.status,401);
});

test('issue reports are role-scoped, validated, and manageable by admins', async()=>{
  const submitted=await request('/api/issues',{method:'POST',cookie:collectorCookie,body:{category:'Missed pickup',description:'The pickup arrived outside the agreed collection window.',batchId,language:'mr'}});
  assert.equal(submitted.status,201,JSON.stringify(submitted.data)); const issue=submitted.data.issue; assert.equal(issue.status,'open'); assert.equal(issue.reporterRole,'collector'); assert.equal(issue.language,'mr');
  const mine=await request('/api/issues/mine',{cookie:collectorCookie}); assert.equal(mine.status,200); assert.ok(mine.data.issues.some(x=>x.id===issue.id));
  const buyerMine=await request('/api/issues/mine',{cookie:buyerCookie}); assert.equal(buyerMine.status,200); assert.ok(!buyerMine.data.issues.some(x=>x.id===issue.id));
  const forbidden=await request('/api/admin/issues',{cookie:buyerCookie}); assert.equal(forbidden.status,403);
  const adminList=await request('/api/admin/issues',{cookie:adminCookie}); assert.equal(adminList.status,200); assert.ok(adminList.data.issues.some(x=>x.id===issue.id));
  const updated=await request(`/api/admin/issues/${issue.id}`,{method:'PATCH',cookie:adminCookie,body:{status:'resolved',resolutionNote:'Contacted the collection team.'}}); assert.equal(updated.status,200); assert.equal(updated.data.issue.status,'resolved');
  const refreshed=await request('/api/issues/mine',{cookie:collectorCookie}); assert.equal(refreshed.data.issues.find(x=>x.id===issue.id).status,'resolved');
  const bad=await request('/api/issues',{method:'POST',cookie:collectorCookie,body:{category:'Unknown',description:'Invalid category test'}}); assert.equal(bad.status,400);
});

test.after(()=>{ if(server&&!server.killed)server.kill('SIGTERM'); setTimeout(()=>{try{fs.rmSync(tempDir,{recursive:true,force:true})}catch{}},100).unref(); });

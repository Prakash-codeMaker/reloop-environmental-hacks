import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('load test requires explicit HTTPS staging confirmation and blocks localhost', () => {
  const script = read('load/k6/reloop-readonly.js');
  assert.match(script, /RELOOP_LOAD_TEST_CONFIRM/);
  assert.match(script, /RELOOP_STAGING_HOST_SUFFIX/);
  assert.match(script, /staging-only/);
  assert.match(script, /parsed\.protocol !== 'https:'/);
  assert.match(script, /localhost/);
  assert.match(script, /read-only/i);
  assert.match(script, /http\.get/);
  assert.doesNotMatch(script, /http\.post\(`\$\{baseUrl\}\/api\/batches/);
});

test('load testing docs distinguish VUs from registered users and require authorized staging', () => {
  const docs = read('load/k6/README.md');
  assert.match(docs, /isolated staging environment/i);
  assert.match(docs, /VUs are not the same as registered users/i);
  assert.match(docs, /does not create listings/i);
});

test('release checklist includes localization, security, backup, load and rollback gates', () => {
  const docs = read('docs/release/RELEASE_READINESS.md');
  for (const phrase of ['Localization and accessibility', 'Security and privacy', 'Load test', 'backup', 'rollback', '10,000–15,000']) assert.ok(docs.includes(phrase), `Missing release gate: ${phrase}`);
});

test('feedback and observability spec prohibits personal data in analytics', () => {
  const docs = read('docs/release/OBSERVABILITY_AND_FEEDBACK.md');
  assert.match(docs, /Do not send names, email, phone/);
  assert.match(docs, /request\/correlation ID/i);
  assert.match(docs, /reporter's own tickets/i);
});

test('Playwright starts the API and web server with isolated test data and ports', () => {
  const config = read('playwright.config.js');
  assert.match(config, /command: 'npm run dev'/);
  assert.match(config, /RELOOP_DATA_DIR: e2eDataDir/);
  assert.match(config, /API_PROXY_TARGET/);
  assert.match(config, /reuseExistingServer: false/);
});


test('AWS S3 evidence integration is optional, private, and documented for the hackathon', () => {
  const server = read('server/server.mjs');
  const template = read('infra/aws/evidence-bucket.yaml');
  const awsGuide = read('infra/aws/README.md');
  assert.match(server, /@aws-sdk\/client-s3/);
  assert.match(server, /RELOOP_S3_BUCKET/);
  assert.match(server, /ServerSideEncryption: 'AES256'/);
  assert.match(server, /You cannot attach evidence to this batch/);
  assert.match(template, /BlockPublicAcls: true/);
  assert.match(template, /RestrictPublicBuckets: true/);
  assert.match(template, /aws:SecureTransport: false/);
  assert.match(awsGuide, /Do not put AWS access keys/);
});

test('hackathon submission pack includes honest AWS and eligibility gates', () => {
  const checklist = read('FINAL_HACKATHON_SUBMISSION_CHECKLIST.md');
  const writeup = read('HACKATHON_SUBMISSION_WRITEUP.md');
  const video = read('DEMO_VIDEO_SCRIPT_UNDER_3_MINUTES.md');
  assert.match(checklist, /old project begun before the event is ineligible/i);
  assert.match(checklist, /AWS use is real and shown in the video/i);
  assert.match(writeup, /does not claim that AWS deployment has already occurred/i);
  assert.match(video, /hard maximum under 3:00/i);
});

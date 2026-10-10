import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTranslationAudit, LANGUAGES, t, translateMessage } from './src/i18n.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'WORKFLOW_IMPROVEMENTS.md'), 'utf8');

test('generator can reuse a prior batch as a new listing template', () => {
  assert.match(app, /Use as template/);
  assert.match(docs, /clearing the old date and creating a new transaction/);
});

test('buyer offer flow has an explicit collection preference and optional note', () => {
  assert.match(app, /collection preference/i);
  assert.match(docs, /The note is optional/);
});

test('collector workflow requires actual accepted weight and evidence before completion', () => {
  assert.match(app, /Enter a valid actual weight/);
  assert.match(app, /Upload handover evidence/);
  assert.match(docs, /actual accepted weight and confirm evidence/);
});

test('transaction table displays final weight using the batch unit, not a hard-coded kg', () => {
  assert.match(app, /Final: \{b\.actualWeight\} \{b\.unit\}/);
  assert.doesNotMatch(app, /Final: \{b\.actualWeight\} kg/);
});

test('role-specific navigation includes verification and task-focused pages', () => {
  for (const label of ['Verification', 'My pickups', 'Find material', 'My listings']) assert.ok(app.includes(label), `Missing navigation label: ${label}`);
});

test('responsive styles exist for mobile workflows', () => {
  assert.match(styles, /@media\s*\(max-width:\s*\d+px\)/);
});


test('live sign-in asks for one role and clearly explains role mismatch', () => {
  assert.match(app, /Choose your workspace/);
  assert.match(app, /expectedRole:role/);
  assert.match(app, /Platform administrator/);
  assert.match(app, /Your account belongs to one role/);
});

test('demo role switching is labelled as demo-only and live records are not reused as demo data', () => {
  assert.match(app, /Demo preview only/);
  assert.match(app, /reloop-demo-v2-batches/);
  assert.match(app, /const returnToDemo=\(\)=>\{setRole\(loadState\('reloop-demo-v2-role'/);
  assert.match(app, /else\{returnToDemo\(\)\}/);
});

test('duplicate signup returns the user to sign-in with password recovery guidance', () => {
  assert.match(app, /An account with this email already exists\. Sign in with your existing password/);
  assert.match(app, /Forgot password if you cannot remember it/);
});


test('language selection supports Indian languages and account-persisted preference', () => {
  const i18n = fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8');
  for (const code of ['en','hi','mr','gu','ta','te','kn']) assert.match(i18n, new RegExp(`value: '${code}'`));
  assert.match(app, /\/profile\/language/);
  assert.match(app, /aria-label={tr\("Your language",language\)}/);
  assert.match(app, /SpeechSynthesisUtterance/);
});

test('all operational roles can report issues and admin has a separate issue queue', () => {
  for (const role of ['generator','buyer','collector']) assert.ok(app.includes(`${role}: {`), `Missing role ${role}`);
  assert.ok((app.match(/\['Report an issue',AlertCircle\]/g)||[]).length >= 3, 'Each role needs issue reporting');
  assert.match(app, /\/admin\/issues/);
  assert.match(app, /\/issues\/mine/);
  assert.match(app, /issue-success/);
});

test('installable shell includes a manifest and does not cache API responses offline', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'public/manifest.webmanifest')));
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(app, /navigator\.onLine/);
});


test('all literal translation keys used through tr() have entries in every supported locale', () => {
  const keys = [...app.matchAll(/\btr\(\s*(['"])(.*?)\1\s*(?:,\s*[^)]*)?\)/gs)].map(match => match[2]);
  for (const match of app.matchAll(/<PageHeading\b([^>]*)\/?>/gs)) { for (const prop of match[1].matchAll(/\b(?:eyebrow|title|description|actionLabel)="([^"]+)"/g)) keys.push(prop[1]); }
  const audit = getTranslationAudit(keys);
  assert.ok(audit.totalKeys >= 60, `Expected broad literal-key coverage, found ${audit.totalKeys}`);
  for (const locale of LANGUAGES) {
    assert.deepEqual(audit.locales[locale.value].missing, [], `Missing translation keys for ${locale.value}`);
  }
});

test('locale-aware date formatting follows the active UI language rather than stale browser detection', () => {
  assert.match(app, /toLocaleDateString\(languageLocale\(language\)/);
  assert.match(app, /toLocaleDateString\(languageLocale\(detectLanguage\(\)\)/);
  assert.match(app, /toLocaleString\(languageLocale\(detectLanguage\(\)\)/);
  assert.doesNotMatch(app, /toLocaleDateString\(\)/);
  assert.doesNotMatch(app, /toLocaleString\(\)/);
});

test('primary navigation has a skip link, main landmark and announced state feedback', () => {
  assert.match(app, /className="skip-link" href="#main-content"/);
  assert.match(app, /<main className="main-area" id="main-content" tabIndex=\{-1\}>/);
  assert.match(app, /aria-current=\{page===label\?'page':undefined\}/);
  assert.match(app, /aria-live="polite" aria-atomic="true"/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});


test('workflow heading variants are translated for every supported locale', () => {
  const keys = [
    'Choose a new password.', 'Welcome back.', 'Create your business workspace.',
    'Good morning, Northstar.', 'Good morning, Pune Fibre Works.', 'Your collection day.',
    'Operations overview', 'List material, compare offers and keep every handover in one place.',
    'Find material that fits your sourcing requirements and manage incoming supply.',
    'Manage assigned collections and record handovers from your phone.',
    'Keep partner onboarding, transactions and exceptions moving reliably.'
  ];
  const audit = getTranslationAudit(keys);
  for (const locale of LANGUAGES) assert.deepEqual(audit.locales[locale.value].missing, [], `Dynamic variants missing for ${locale.value}`);
});

test('common action feedback uses the selected locale', () => {
  for (const locale of LANGUAGES.filter(item => item.value !== 'en')) {
    assert.notEqual(translateMessage('Offer submitted to the material owner.', locale.value), 'Offer submitted to the material owner.', `${locale.value} notification fell back to English`);
    assert.notEqual(t('Confirm', locale.value), 'Confirm', `${locale.value} confirmation button fell back to English`);
    assert.notEqual(translateMessage('Issue DEMO-123 recorded in this browser demo.', locale.value), 'Issue DEMO-123 recorded in this browser demo.', `${locale.value} issue confirmation fell back to English`);
  }
});

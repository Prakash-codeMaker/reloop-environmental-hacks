import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTranslationAudit, LANGUAGES } from '../src/i18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = ['src/main.jsx'];
const source = sourceFiles.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
// Capture literal keys passed to tr('...') or tr("..."). Dynamic expressions are reported separately.
const keys = [];
const literalCall = /\btr\(\s*(['"])(.*?)\1\s*(?:,\s*[^)]*)?\)/gs;
for (const match of source.matchAll(literalCall)) keys.push(match[2]);
// PageHeading routes dynamic props through tr() internally; audit literal props at call sites too.
for (const match of source.matchAll(/<PageHeading\b([^>]*)\/?>/gs)) {
  for (const prop of match[1].matchAll(/\b(?:eyebrow|title|description|actionLabel)="([^"]+)"/g)) keys.push(prop[1]);
}
// Explicitly audit the finite branches currently passed dynamically to tr(). Keep this list in sync when adding role/page variants.
const dynamicValues = [
  'Choose a new password.', 'Welcome back.', 'Create your business workspace.',
  'Use a new password of at least 12 characters.',
  'Sign in to access shared listings, offers and transaction records.',
  'Create an account to start coordinating recyclable material with other participants.',
  'Good morning, Northstar.', 'Good morning, Pune Fibre Works.', 'Your collection day.', 'Operations overview',
  'List material, compare offers and keep every handover in one place.',
  'Find material that fits your sourcing requirements and manage incoming supply.',
  'Manage assigned collections and record handovers from your phone.',
  'Keep partner onboarding, transactions and exceptions moving reliably.',
  'Your next pickups', 'Material worth reviewing', 'Platform activity', 'Needs your attention',
  'The next steps to keep your material moving.', 'Relevant batches and sourcing activity.',
  'Jobs assigned to your collection team.', 'A snapshot of activity in the demo workspace.',
  'Across current workflows', 'Across sample listings', 'Across your material batches', 'Active batches', 'Active listings', 'Assigned jobs',
  'Built for accountable handovers', 'Check access details and schedule', 'Check schedule and access', 'Close the loop', 'Completed records',
  'Completed sample jobs', 'Completed sample transactions', 'Completed sourcing', 'Confirm actual weight and evidence', 'Currently in the marketplace',
  'Due today', 'Exceptions', 'Filter by type, quantity and location', 'Find completed sourcing records', 'Find disputed or incomplete records',
  'Find the right supply', 'Handover record needed', 'How records work', 'In the sample workspace', 'Inspect audit history',
  'Jobs assigned to your team', 'Keep operations healthy', 'Keep work moving', 'List another batch', 'Live view', 'Manage partner profiles',
  'Matching available supply', 'Offers pending', 'Offers sent', 'Open assigned pickups', 'Open transaction history', 'Recent material',
  'Recent transactions', 'Record a handover', 'Records available in history', 'Require admin review', 'Require participant action',
  'Reuse your usual business details', 'Review exceptions', 'Review new offers', 'Review onboarding and role access',
  'Review recorded workflow activity', 'Review weight and handover details', 'Review your recent collection history', 'Review your sourcing',
  'Scheduled or awaiting pickup', 'Track offers and accepted batches', 'Upcoming material receipts', 'View completed jobs', 'offers awaiting a decision',
  'Offer declined.', 'Offer pending.', 'Offer rejected.', 'has been selected.',
  'Issue recorded on the shared workspace.', 'Issue recorded in this browser demo.'
];
keys.push(...dynamicValues);
const dynamicCalls = [...source.matchAll(/\btr\(\s*(?!['"])([^,)\n]+)/g)].map(match => match[1].trim());
const audit = getTranslationAudit(keys);
const strict = process.argv.includes('--strict');
console.log(`ReLoop localization audit — ${new Date().toISOString()}`);
console.log(`Scanned ${sourceFiles.length} source file(s); found ${audit.totalKeys} unique literal translation keys.`);
for (const locale of LANGUAGES) {
  const result = audit.locales[locale.value];
  const percent = result.total ? Math.round(result.translated / result.total * 100) : 100;
  console.log(`\n${locale.value.padEnd(2)} ${String(percent).padStart(3)}% (${result.translated}/${result.total})`);
  if (result.missing.length) {
    console.log(`  Missing (${result.missing.length}): ${result.missing.slice(0, 100).join(' | ')}${result.missing.length > 25 ? ' | …' : ''}`);
  }
}
console.log(`\nDynamic translation expressions needing manual review: ${dynamicCalls.length}`);
if (dynamicCalls.length) console.log(`  ${[...new Set(dynamicCalls)].slice(0, 15).join(' | ')}`);
console.log('\nNote: key coverage does not measure translation quality, context, or hardcoded text outside tr().');
const missingRequired = Object.entries(audit.locales).some(([locale, result]) => locale !== 'en' && result.missing.length > 0);
if (strict && missingRequired) process.exitCode = 1;

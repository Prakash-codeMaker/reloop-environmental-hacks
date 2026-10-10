import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/main.jsx'];
const candidates = [];
const seen = new Set();
const ignored = new Set(['button','div','span','strong','small','label','option','main','section','header','footer','nav','table','thead','tbody','tr','td','th','form','input','select','textarea','p','h1','h2','h3','h4','i','svg','path','true','false','null','undefined','http','https']);
function add(file, line, kind, value) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || text.length < 2 || text.length > 220 || !/[A-Za-z\u0900-\u097F\u0A80-\u0AFF\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF]/u.test(text)) return;
  if (text.startsWith('{') || text.startsWith('tr(') || text.startsWith('//') || ignored.has(text.toLowerCase())) return;
  if (/^[A-Za-z]+(?:-[A-Za-z]+)*$/.test(text) && ignored.has(text.toLowerCase())) return;
  const key = `${file}:${line}:${kind}:${text}`;
  if (seen.has(key)) return;
  seen.add(key); candidates.push({ file, line, kind, text });
}
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    // Text nodes in JSX. Dynamic expressions are intentionally excluded and tracked separately.
    for (const match of line.matchAll(/>([^<>]+)</g)) {
      const value = match[1].trim();
      if (!value || value.startsWith('{') || value.endsWith('}')) continue;
      if (/[A-Za-z]{2}/.test(value)) add(file, i + 1, 'jsx-text', value);
    }
    // User-facing HTML/ARIA attributes that should be localized or intentionally documented.
    for (const match of line.matchAll(/\b(placeholder|title|aria-label|alt)\s*=\s*(["'])(.*?)\2/g)) {
      add(file, i + 1, match[1], match[3]);
    }
    // Literal UI messages inside conditional expressions or callbacks passed to notifications/errors.
    for (const match of line.matchAll(/(?:notify|setError|setNotice)\(\s*(["'`])([^"'`]{3,180})\1/g)) {
      add(file, i + 1, 'message', match[2]);
    }
  });
}
const report = {
  generatedAt: new Date().toISOString(),
  filesScanned: files,
  candidateCount: candidates.length,
  caveat: 'Heuristic scan only. It can miss dynamic expressions and can flag non-user-facing strings. Review candidates before changing source.',
  candidates
};
fs.writeFileSync(path.join(root, 'LOCALIZATION_UI_TEXT_AUDIT.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# ReLoop hardcoded UI text audit', '',
  `- Generated: ${report.generatedAt}`,
  `- Source files scanned: ${files.join(', ')}`,
  `- Candidate strings: ${candidates.length}`,
  '',
  '> This is a heuristic backlog, not a claim that every candidate is user-facing or that every user-facing string was detected. Dynamic JSX expressions, server-returned errors, and translations need separate review.',
  '',
  '| Source line | Kind | Candidate |', '|---:|---|---|',
  ...candidates.slice(0, 500).map(x => `| ${x.line} | ${x.kind} | ${x.text.replace(/\|/g, '\\|')} |`),
  '',
  `The JSON report contains ${candidates.length} candidates. Prioritize user-visible controls, errors, validation, statuses, notifications and confirmation messages. Do not translate user-generated business/material content automatically.`
].join('\n');
fs.writeFileSync(path.join(root, 'LOCALIZATION_UI_TEXT_AUDIT.md'), md + '\n');
console.log(`Scanned ${files.length} file(s); recorded ${candidates.length} heuristic UI-text candidates.`);
console.log('Wrote LOCALIZATION_UI_TEXT_AUDIT.md and LOCALIZATION_UI_TEXT_AUDIT.json');

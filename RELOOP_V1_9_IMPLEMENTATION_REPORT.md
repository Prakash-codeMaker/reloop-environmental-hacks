# ReLoop v1.9.0 — localization coverage and workflow feedback

## What changed

- Added first-pass Hindi, Marathi, Gujarati, Tamil, Telugu and Kannada translations for high-frequency verification, listing, offer, collection, issue-reporting, dashboard, and administration labels and instructions.
- Localized additional JSX text nodes and accessible attributes only when all seven dictionaries contain the exact key. This avoids silently wrapping unreviewed English text and calling it translated.
- Added translations for finite dynamic headings, role descriptions, dashboard stats, action descriptions, and common success/error feedback. `translateMessage()` localizes supported notification patterns while leaving unknown backend messages unchanged rather than guessing.
- Updated the app's notification handler to use the active language for known messages.
- Corrected date/time formatting in verification, issue and audit views to use the persisted active locale instead of the browser's default locale.
- Expanded the strict localization audit to include 271 literal and explicitly enumerated dynamic UI keys.
- Added tests for dynamic heading coverage and locale-aware action feedback.
- Added an end-to-end test that switches through all seven supported languages and checks the navigation labels.

## Verification performed

- `npm test`: **29 passed, 0 failed**.
- `npm run i18n:check`: **passed**; 271 audited keys have dictionary entries for all seven locales.
- `npm run i18n:surface`: completed and generated a heuristic inventory of **118 remaining hardcoded-text candidates** in `src/main.jsx`.
- TypeScript JSX transpilation/syntax checks: passed for the main UI, translation module, and E2E spec.

## Known limitations — do not call this fully localized yet

- The 118 candidates are not all confirmed user-facing strings; the heuristic can flag fragments and miss dynamic content. They still need manual review, and there are visible English phrases that have not yet been migrated.
- `i18n:check` guarantees dictionary coverage only for keys in its audited set. It does not prove linguistic accuracy, contextual correctness, or complete UI coverage.
- Some backend errors and dynamic workflow notifications are still returned/displayed in English when there is no approved mapping.
- The new Playwright/axe browser tests were authored but not executed in this environment because npm dependency installation timed out. The Vite production build therefore remains unverified, and no public staging deployment was performed.
- Native-speaker review is still required for all six non-English translations, especially business/legal/verification wording.

## Local verification commands

```bash
npm install
npm run test:quality
npm run build
npx playwright install chromium
npm run test:e2e
```

Before a pilot, manually review the remaining UI-text inventory, verify every role's critical workflow in each language, inspect browser accessibility findings, and obtain native-speaker review.

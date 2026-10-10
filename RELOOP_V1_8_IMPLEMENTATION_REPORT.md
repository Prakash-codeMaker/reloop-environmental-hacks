# ReLoop v1.8.0 — Localization and accessibility quality foundation

## Implemented in this release

- Expanded the localization key audit to include literal props passed into `PageHeading`, so those titles, eyebrows and descriptions are no longer invisible to the strict dictionary-coverage check.
- Added reviewed first-pass translations for the four administrative/verification page heading sets across Hindi, Marathi, Gujarati, Tamil, Telugu and Kannada. Native-speaker review is still required before public use.
- Fixed the overview date-formatting bug so it uses the currently selected language instead of re-detecting the saved/browser language during rendering.
- Added a heuristic hardcoded UI-text inventory: `npm run i18n:surface` generates `LOCALIZATION_UI_TEXT_AUDIT.md` and `.json`. The current run reports 252 candidates. This is a review backlog, not proof that all 252 strings are user-facing or that every user-facing string was detected.
- Added Playwright browser tests for locale persistence, keyboard skip-link behavior, mobile layout and axe-core accessibility checks.
- Added GitHub Actions quality workflows for API/workflow tests, translation-key coverage, the UI-text inventory, production build, and browser accessibility tests.

## Verification performed in this environment

- `npm test`: 27 passed, 0 failed.
- `npm run i18n:check`: passed; 82 unique literal keys were found and all have entries in the six non-English dictionaries. English is the source/fallback language.
- `npm run i18n:surface`: completed; 252 heuristic candidates recorded.
- ZIP integrity check: performed before delivery.

## Not verified

- `npm install` timed out in this environment, so dependencies could not be installed.
- `npm run build` was not run successfully; Vite is not installed locally.
- Playwright and axe-core browser tests have been authored but not executed here.
- No public staging deployment or native-speaker review was performed.
- The 82-key coverage check does not mean the whole site is translated. Twenty-two dynamic translation expressions and the hardcoded-text inventory still require manual review. Translation completeness must be checked on rendered pages, including forms, validation, notifications, statuses, dialogs and backend errors.

## Commands after dependencies can be installed

```bash
npm install
npm run test:quality
npm run build
npx playwright install chromium
npm run test:e2e
```

## Recommended acceptance bar

Do not describe the product as fully localized or WCAG-conformant until the UI-text backlog is reviewed, all core workflows are tested in each supported language, axe findings are triaged, keyboard/screen-reader checks are completed, and native speakers review translations in context.

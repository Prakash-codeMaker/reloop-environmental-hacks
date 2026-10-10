# Localization and accessibility audit — v1.9.0

## Verified coverage

- Seven language options are available: English, Hindi, Marathi, Gujarati, Tamil, Telugu and Kannada.
- The strict audit checks 271 literal keys and explicitly enumerated dynamic UI variants; all seven dictionaries currently contain entries for all audited keys.
- Common notification feedback and date/time formatting now use the active stored locale where a reviewed translation is available.
- A heuristic scan still reports 118 possible hardcoded UI-text candidates. This is a review backlog, not a count of confirmed untranslated labels and not proof that all text has been detected.

## Remaining work

1. Review `LOCALIZATION_UI_TEXT_AUDIT.md` and classify each candidate as UI text, user-generated/sample data, a code fragment, or a false positive.
2. Migrate every confirmed UI label, placeholder, status, validation message, confirmation, toast, empty state, tooltip and accessible name to a translation key.
3. Enumerate all finite dynamic values (including backend error codes and status values) in the localization audit. Do not translate arbitrary user-generated material descriptions automatically.
4. Add server error codes and locale-neutral API errors, mapping them to client-side localized messages. Unknown errors should remain actionable and be logged for review.
5. Execute Playwright + axe tests on a production build and add role-by-role workflows for generator, buyer, collector and admin in all seven locales.
6. Manually test keyboard-only use, screen readers, zoom, narrow viewports, long translations and low-connectivity behavior.
7. Obtain native-speaker review before public use.

## Release gate

A 100% dictionary-coverage result is necessary but not sufficient. ReLoop must not be described as fully localized or WCAG-conformant until rendered pages, dynamic states, backend errors, and end-to-end role workflows have been reviewed and tested.

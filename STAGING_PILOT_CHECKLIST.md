# ReLoop staging and pilot checklist

## Automated checks

- [x] API workflow tests for signup, role permissions, batches, offers, collection evidence, verification, issues and language preference.
- [x] Static JSX/JavaScript syntax transpilation check performed for this bundle.
- [x] PWA manifest and service-worker shell added.
- [ ] Full Vite production build (blocked: Vite absent; npm install failed with registry DNS error `EAI_AGAIN`).
- [ ] Browser-driven test on desktop and mobile (not run in this environment; no browser automation/dependencies available).
- [ ] Live staging deployment with HTTPS and real secrets.

## Manual staging run

1. Register three separate test accounts: generator, buyer and collector.
2. Set each language independently; confirm preference survives logout/login.
3. Generator publishes a batch; buyer submits an offer; generator accepts; admin assigns a collector; collector records actual weight and evidence; authorized participants confirm the resulting transaction state.
4. Report a missed pickup from the collector account. Confirm the report has a reference, appears in the reporter's list, appears in the admin queue, can be resolved by an admin, and the updated status is visible to the reporter.
5. Confirm users cannot see another participant's issue reports or access admin issue routes.
6. Test Hindi and Marathi with native speakers first, then review Gujarati, Tamil, Telugu and Kannada translations before advertising those locales as fully supported.
7. Disconnect the network. Confirm the shell may load from cache and that the UI warns before shared writes; confirm API responses are not cached. Reconnect and ensure no duplicate transaction is created.
8. Test password recovery, email verification, role mismatch, evidence access permissions and admin actions.
9. Test keyboard and screen-reader operation, text zoom, touch targets, contrast and error recovery.
10. Only pilot with real businesses after provider credentials, privacy notice, support ownership, backups, monitoring and applicable regulatory review are complete.

## Not yet production verified

This archive is a staging candidate, not a claim of live deployment. Email/SMS provider configuration, third-party business verification, public hosting/domain, browser E2E coverage, native-speaker translation review and full frontend production build remain deployment tasks.

# ReLoop end-to-end workflow validation

This checklist covers the real user journey across all three operating roles. Use a staging environment and test accounts, never real customer data.

## Automated checks

Run:

```bash
npm test
```

- `test-api.mjs` exercises the backend workflow across generator, buyer, collector and administrator accounts.
- `test-workflow.mjs` checks critical UI workflow affordances and guards against a known unit-display regression.

## Browser walkthrough

1. Start ReLoop with `npm install` and `npm run dev`.
2. In the demo workspace, open **My listings** as a generator and create a new batch. Confirm required fields are understandable and errors do not erase entered data.
3. Open a listing and choose **Use as template**. Change quantity and publish. Confirm a new batch ID is created and the original remains unchanged.
4. Switch to the buyer role. Search by material and location, open the new batch, and submit an offer with a collection preference. Leave the note blank to confirm it is optional.
5. Switch back to the generator. Confirm the offer is visible and accept it. Check that the status and agreed price update consistently.
6. In the live/staging workflow, use an administrator account to assign a registered collector. Do not treat demo assignments as real assignments.
7. Switch to the assigned collector. Open **My pickups**, mark the job collected, then enter the actual accepted weight and upload handover evidence.
8. Try to complete the handover without a positive actual weight or without evidence. The app/API must reject completion and explain what is missing.
9. Complete the handover with valid data. Confirm all authorized roles see the same final status, actual weight and transaction record.
10. Check notifications, verification status and audit records. Confirm that one role cannot access another role's restricted records.
11. Repeat on a narrow mobile viewport. Verify that collector actions are reachable with one hand, labels remain readable and forms do not require horizontal scrolling.

## Acceptance criteria

- A generator can create a listing without re-entering saved business details unnecessarily.
- A buyer can find and offer on suitable material without mandatory free-text prose.
- A collector can complete the pickup without re-entering known transaction details.
- Estimated quantity and actual accepted weight are visually distinguished.
- The displayed unit matches the batch unit everywhere.
- No action claims that a live buyer, verification provider, collection or payment exists unless the backend/provider confirms it.
- The demo workspace is clearly labelled and cannot be mistaken for shared live records.

## Test limitations

Automated API tests do not replace browser-based end-to-end testing. Run the browser walkthrough before any pilot release. Third-party email, SMS, business verification and payment flows require configured provider credentials and must be tested in the provider's sandbox.

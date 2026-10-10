# ReLoop role-aware verification design

## User experience

The generator, buyer/recycler, and collector/logistics workspaces each expose a Verification page. The page shows three distinct checks: contact email, organization/identity evidence, and role-specific evidence. The registration form explains the selected role's verification path before the user submits.

## Role-specific evidence types

- **Material generator:** business registration, tax document, address proof, material-source evidence, or other supporting evidence.
- **Buyer/recycler:** business registration, tax document, address proof, purchasing authorization, processing capability evidence, or other supporting evidence.
- **Collector/logistics:** responsible-person identity document, address proof, vehicle document, transport permit when applicable, or other supporting evidence.

The API rejects evidence types outside the role's allowed list. Uploaded evidence changes relevant check states to `in_review`; an upload never marks an account verified. Admin approval requires at least one relevant document and is recorded in the audit trail.

## Important trust boundary

Email verification proves control of an email address, not legal business identity. Document review is manual unless a specific external provider is integrated and configured. The signed KYB webhook is a provider adapter contract; it does not perform an identity lookup by itself. No SMS OTP provider is configured in this bundle. Demo verification states are illustrative only.

## Low-friction principles

- Ask for role-relevant information only.
- Do not require documents that do not apply to the participant.
- Show pending, in-review, verified, and rejected states explicitly.
- Explain the next action instead of blocking the user without guidance.
- Restrict document access to the participant and authorized reviewers.
- Do not treat a profile as trusted solely because it registered successfully.

## Tests

`npm run test:api` covers the three role-specific checklist definitions, allowed and disallowed evidence types, document review status, and verification status updates after admin approval.

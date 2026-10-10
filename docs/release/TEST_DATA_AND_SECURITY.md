# ReLoop staging data and security controls

- Use synthetic businesses, synthetic locations and clearly marked test material. Never import production evidence or personal data into staging unless an approved, minimized and protected process explicitly requires it.
- Seed dedicated test accounts per role; store credentials in the CI secret store or an approved secret manager, not in code or test reports.
- Restrict staging access; do not treat an unlisted URL as access control.
- Keep payment and identity-provider integrations in sandbox mode. Use webhook test secrets distinct from production.
- Ensure staging emails/SMS cannot contact real users; use a sink/test mailbox unless delivery is specifically under test.
- Reset or expire test data after each test window and preserve only aggregate results required for engineering analysis.
- Verify object-level authorization with separate accounts, especially listing, offer, evidence and issue resources.
- Ensure file uploads have strict size/type limits, randomized storage names, non-public storage and authorized downloads; add malware scanning before accepting public uploads at scale.
- Document data retention and deletion, access logging, incident contact and backup encryption before launch.

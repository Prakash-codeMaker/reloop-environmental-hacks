# ReLoop — authentication and role isolation fixes

## What changed

- Live sign-in now asks the user to select the workspace role they expect to use: Material generator, Buyer / recycler, Collector / logistics, or Platform administrator.
- After validating the email and password, the API checks the selected role against the account's server-stored role. A mismatch receives a clear message and does not create a session.
- Admin remains a provisioned role. Public signup still accepts only generator, buyer, or collector; it cannot create admin accounts.
- Duplicate registration with an existing email returns the user to Sign in, preserves the email, clears the password, and explains that the account already exists. The user can sign in or use password recovery.
- The demo workspace explicitly labels role switching as a demo-only preview, so it cannot be mistaken for multi-role access on a real account.
- Demo state now uses separate versioned localStorage keys. Returning from a live account restores only the demo snapshot and does not persist live API records into demo storage.
- Back to demo, the workspace environment toggle, and the account menu all use the same safe return-to-demo handler.

## Why a user might see an invalid email/password message

- If the email is already registered, do not create another account with it. Choose Sign in and use the same password, or use Forgot password.
- If sign-in reports a role mismatch, choose the role used when the account was registered.
- If the password genuinely is not accepted, use Forgot password. Passwords are stored as salted hashes and cannot be retrieved in plain text.
- In production, email verification must be completed if required by the deployment configuration.

## Role separation

The selected role is a UX confirmation only. The API remains authoritative: the account role is stored on the server, the workspace response is based on that role, and protected operations check server-side permissions. Do not rely on hiding navigation items alone as a security boundary.

## Test

Run:

```bash
npm test
```

The test suite includes valid role login, mismatched role login, provisioned admin login, duplicate registration, transaction permissions, and checks that the demo-only switcher and separate demo storage are present.

# ReLoop language and accessibility notes

## Included in this bundle

- Initial language detection from browser language when no preference exists. Users can override it at any time. No location permission or GPS is used to infer language.
- Language choices: English, Hindi, Marathi, Gujarati, Tamil, Telugu and Kannada.
- Preference is saved on the device and persisted to the authenticated account through the profile-language endpoint.
- Navigation, shared-workspace controls and selected high-frequency labels are translated. The translation dictionary is an initial implementation, not a claim of complete localization.
- Browser speech synthesis provides a short spoken task guide; voice availability varies by device and installed voices.
- A visible offline notice warns users that shared writes need a connection. A service worker caches the app shell/static assets but never caches API responses.
- Issue reports can be submitted in the user's own language. The application stores the original text; it does not automatically translate reports for support agents.

## Required before public rollout

1. Have native speakers in each launch region review all visible strings, error messages, material terminology, pricing/weight language, consent and verification copy.
2. Run usability sessions with people with different literacy levels, disabilities, device types and connectivity. Do not use caste, religion, gender or education to rank access or participants.
3. Test WCAG 2.2 AA, keyboard navigation, screen readers, zoom/reflow, colour contrast and large touch targets.
4. Test the language preference on account creation, sign-in, sign-out and multiple devices.
5. Configure and test actual email/SMS and business-verification providers separately; language selection does not mean verification is live.
6. If full offline drafts are required, implement an explicit local draft queue with conflict handling and consent before attempting background synchronization. This bundle does not silently queue or submit transactions offline.

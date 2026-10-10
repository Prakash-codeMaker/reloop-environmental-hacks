# ReLoop v1.3 — Low-friction workflow changes

This update focuses on reducing repeated work across the generator → buyer → collector journey.

## Material generator

- The listing form remembers the last used material, category, unit, condition, location and optional details.
- Saved listing defaults are scoped to the local demo workspace or the signed-in account's browser storage key.
- A batch detail page offers **Use as template**. It copies reusable material details into a fresh listing while clearing the old date and creating a new transaction when published.
- The new listing is still validated before publishing; quantity and location are required.

## Buyer / recycler

- Offers use a dedicated collection-preference field instead of treating the free-text note as both schedule and commercial conditions.
- The note is optional, so buyers can submit an offer without writing unnecessary prose.
- In demo mode, a new offer is saved into the shared browser-local demo state, appears in the generator's Offers page when roles are switched, and updates a listed batch to `Offer received`.
- Demo mode explicitly states that these offers are not sent to real businesses.
- Buyers only see the offer form while a batch is `Listed` or `Offer received`.

## Collector / logistics

- The assigned-pickup list includes a direct **Mark collected** action.
- After the collection status update, the handover detail opens so the collector can enter actual accepted weight and confirm evidence.
- Live completion still requires uploaded evidence; demo mode uses a visible confirmation checkbox and sample-only records.
- Mobile evidence input requests camera capture where the browser/device supports it.

## Data clarity and validation

- Paper, PET and rigid-plastic categories map to the correct material category.
- Actual weight and offer unit labels follow the batch's configured unit rather than always displaying kilograms.
- Real collector assignment and live offer delivery are not fabricated by demo shortcuts.

## Validation performed

- Frontend JSX syntax was transpiled using the installed TypeScript parser.
- The backend API integration test suite passed 10/10 tests.
- A full Vite production build was not run because frontend dependencies are not installed in this environment. Run `npm install` and `npm run build` locally to verify the complete bundle.

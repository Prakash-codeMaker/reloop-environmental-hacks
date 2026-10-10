# ReLoop — Environmental Hacks 2026

**Track:** Waste and Energy  
**Project:** ReLoop — commercial recyclable-material coordination  
**Team:** [enter team name and members]  
**Public repository:** [paste public GitHub URL]  
**Demo video (YouTube, public/unlisted, under 3 minutes):** [paste URL after recording]  
**Live app (if deployed):** [paste URL; do not invent or use a local URL]

## Problem

Businesses and institutions generate recyclable dry material such as cardboard and paper. A successful recovery transaction requires more than awareness: a suitable buyer or recycler must accept the material, the quantity and collection details must be agreed, a collector must coordinate pickup, and both sides need a record of the handover. These steps can be fragmented across calls and messages, making it harder to track status or verify what happened.

ReLoop targets that coordination gap. The initial pilot hypothesis is deliberately narrow: help local commercial material generators, buyers/recyclers and collectors coordinate dry recyclable batches, starting with cardboard and paper in a defined local area. The prototype does not claim to have measured environmental impact or proven market demand yet.

## What we built

ReLoop is a role-aware web application with separate workflows for:

- **Material generators:** create material batch listings and review offers.
- **Buyers/recyclers:** discover available batches and submit offers.
- **Collectors/logistics:** manage assigned pickups, record actual accepted weight and attach handover evidence.
- **Administrators:** review verification information, manage issues and support transaction workflows.

The backend validates roles and transaction transitions, records audit events, and requires evidence before a collector completes a handover. The UI includes seven language choices (English, Hindi, Marathi, Gujarati, Tamil, Telugu and Kannada), first-pass translation coverage, issue reporting and an installable application shell. Translation and accessibility work remains incomplete and is being audited; this is not represented as full WCAG conformance or professional translation.

## Implementation and stack

- React + Vite frontend.
- Node.js HTTP API with server-side role checks and session handling.
- PostgreSQL-oriented persistence with a local JSON development mode.
- Automated Node test suite, localization audits and Playwright/axe browser tests (browser suite still needs to be executed in a dependency-complete environment).
- OpenSearch integration for buyer discovery. When `RELOOP_OPENSEARCH_URL` is configured, the `/api/matches` route indexes only discoverable material-listing fields and queries the open-source OpenSearch engine for full-text/fuzzy search. Search hits are intersected with the API's current authorized candidate batches. When OpenSearch is unavailable, the API falls back to built-in search.
- Optional private S3 evidence storage using the open-source AWS SDK for JavaScript v3. `infra/aws/evidence-bucket.yaml` defines a private, encrypted, versioned S3 bucket with public access blocked and TLS enforced. When `RELOOP_S3_BUCKET` is configured, handover and verification evidence use S3; otherwise development uses local disk.

## Where AWS fits

**Hackathon Build It path:** Environmental Hacks lists OpenSearch under its AWS open-source tool options. ReLoop uses OpenSearch for a product-specific purpose: buyers need to find cardboard, paper, plastic and other available material by terms and locality, rather than browse an unranked list. The API sends only discoverable listing fields to the local OpenSearch index, then intersects results with the currently authorized batch candidates. It never indexes evidence files, identity documents, credentials or private account fields. This local mode uses the open-source OpenSearch engine and does not require an AWS account or cloud resources.

**Deployment boundary:** the local OpenSearch container is not Amazon OpenSearch Service and is not a cloud deployment. The optional S3 integration is implemented but not deployed or verified. This write-up does not claim that AWS deployment has already occurred. Do not claim live S3, AWS hosting, or Amazon OpenSearch Service unless separately configured and tested. The local OpenSearch demo must actually be running and shown in the video for the Build It route to be evidenced.

## How to evaluate the demo

Follow `OPENSEARCH_BUILD_IT_GUIDE.md`: start the local OpenSearch container, open ReLoop as a buyer, search for a material or locality, show the `/api/matches` response reporting `searchEngine: "OpenSearch"`, and show the OpenSearch index query. Then show the generator/buyer/collector workflow. If Docker/OpenSearch cannot be run and shown, do not claim this integration was demonstrated. The optional S3 integration can be shown only after a real AWS sandbox deployment and successful upload/retrieval.

## What is tested

At the time this submission pack was prepared, `node --test test-api.mjs test-workflow.mjs test-release-tooling.mjs` passed **36 tests** in the available environment (re-run on 10 October 2026). The localization key audit covers 271 known keys across seven dictionaries. These checks do not prove that every visible string is translated, that the production build succeeds, or that the browser accessibility suite passes. Production build, Playwright/axe execution, running the OpenSearch demo, AWS sandbox deployment and load testing remain release gates.

## Limitations and next steps

- The current persistence compatibility layer loads datasets into memory and serializes writes; it is not ready for high-throughput multi-instance operation.
- Local-disk evidence storage remains the default until S3 is configured. Local OpenSearch is optional and must be started separately to demonstrate the Build It path.
- Full UI localization, native-speaker review and complete accessibility testing remain outstanding.
- The prototype has not demonstrated real-world waste diverted, financial savings, buyer liquidity or verified recycling outcomes. Those must be measured in a local pilot.
- The first pilot should focus on a small geographic area and ordinary commercial dry recyclables. Regulated categories such as e-waste need separate compliance review.

## AI and third-party tools disclosure

List the AI coding tools actually used by the team and describe how they were used: [complete accurately]. Credit third-party code, icons, libraries, APIs and assets with their licences. Do not claim that generated code was independently written by a team member if it was not.

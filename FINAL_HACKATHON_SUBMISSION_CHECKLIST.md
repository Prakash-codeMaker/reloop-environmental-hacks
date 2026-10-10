# Final submission checklist — Environmental Hacks 2026

Official event page: https://www.wemakedevs.org/aws/env  
Rules: https://www.wemakedevs.org/aws/env/rules  
Published deadline: Sunday, 11 October 2026, 8:00 PM IST. Verify the submission form before relying on this time.

## Hard eligibility gates

- [ ] Confirm all team members are university students in India, at least 18, registered individually, and team size is 1–4.
- [ ] Confirm each member has a WeMakeDevs account and AWS Builder Center profile with university enrollment verification as required.
- [ ] **Confirm project eligibility honestly:** official rules say the project must be built after the hackathon opens; an old project begun before the event is ineligible even if rewritten. The ZIP history alone does not prove when the project began. Do not submit if this rule is not met; ask organisers if unsure.
- [ ] Keep the repository public and ensure commit history accurately reflects work; do not backdate commits or misrepresent earlier work.
- [ ] Credit third-party code/assets and ensure licences permit use.
- [ ] List AI coding tools actually used in the write-up.

## Required deliverables

- [ ] Public GitHub repository URL works signed out.
- [ ] README explains problem, target user, architecture, setup, limitations and AWS use.
- [ ] Demo video is uploaded to YouTube, is public or unlisted, and runs **under 3 minutes**.
- [ ] Video link opens signed out; no secrets or private user data are visible.
- [ ] Short write-up describes the problem, build, stack and AWS integration.
- [ ] AWS use is real and shown in the video: for the no-cloud Build It route, start the OpenSearch open-source container, perform a buyer search in ReLoop, show the API response reporting OpenSearch, and show the actual index query. Alternatively, deploy a real AWS service and show it. Merely mentioning AWS in the write-up is not enough.
- [ ] Submission form is completed once per team before the deadline shown on the event page.

## Product quality gates

- [ ] `npm install` succeeds from a clean clone.
- [ ] `npm run test:quality` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` passes after Playwright browser install; review axe results and manually test keyboard flow.
- [ ] Test generator → buyer offer → acceptance → collector handover with synthetic accounts.
- [ ] Confirm role permissions and evidence access boundaries.
- [ ] Review remaining localization audit candidates; do not claim complete translation or WCAG conformance without evidence.
- [ ] Do not claim load capacity or real environmental impact without measurements.

## Status in the packaged workspace

- [x] API/workflow/release-tooling tests: 36 passed in the latest local run.
- [x] Seven locale dictionaries contain 271 audited translation keys.
- [x] Optional S3 evidence adapter and secure CloudFormation bucket template added in this package.
- [ ] AWS bucket deployment and live upload/retrieval not yet verified.
- [ ] Local OpenSearch integration is coded but has not been run in this environment because Docker is unavailable; follow `OPENSEARCH_BUILD_IT_GUIDE.md` and verify it before recording.
- [ ] Production build not yet verified in this environment.
- [ ] Browser E2E/axe tests not yet executed.
- [ ] Public GitHub repository and YouTube demo URL not yet supplied.
- [ ] Eligibility date of the earliest project work must be confirmed by the team.

**Do not submit until every hard eligibility gate and required deliverable is complete.**

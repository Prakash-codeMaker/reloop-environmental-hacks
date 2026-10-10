# Environmental Hacks 2026 — Rules and judge alignment

**Official event:** https://www.wemakedevs.org/aws/env  
**Official rules:** https://www.wemakedevs.org/aws/env/rules  
**Event window:** 8–11 October 2026  
**Published online deadline:** Sunday, 11 October 2026, 8:00 PM IST (verify the live submission form before submitting).

## Track choice

**Waste and Energy** is the closest fit. The official track includes segregation, recycling, e-waste, informal recyclers, rooftop solar, EV nudges and public transport. ReLoop addresses the recycling/collection part of the track by coordinating commercial recyclable batches with buyers and collectors.

## Official judging criteria and ReLoop response

The event page publishes qualitative criteria but does not provide numerical weights. Do not invent a scoring percentage.

| Official criterion | What judges are looking for | ReLoop evidence to show | Current caveat |
|---|---|---|---|
| Idea and Impact | A real environmental problem and a clear change for people affected | A specific commercial cardboard/paper coordination problem; one complete batch-to-handover journey; explain which failure point it addresses | Market demand and actual material diverted have not yet been measured; call these pilot hypotheses |
| Built on AWS | Use an AWS open-source tool or deploy on AWS; show actual use in the demo | OpenSearch open-source integration provides buyer material discovery; optional S3 evidence storage is also implemented | Local OpenSearch has not been run in this environment (Docker unavailable here). Start it and show a real buyer search and OpenSearch query before claiming this path is demonstrated. S3 is not deployed. |
| Design and usability | Clear, usable by people outside the team | Role-specific tasks, simple batch details, seven language choices, status feedback and issue reporting | Translation is not complete; 118 UI text candidates and 22 dynamic expressions were previously flagged for review; native-speaker and accessibility testing outstanding |
| Execution | Working implementation; one working feature beats many unfinished features | Demonstrate generator → buyer offer → acceptance → collector evidence → completion; API/workflow tests | 36 automated tests pass in this package, but production build and Playwright/axe browser suite remain unverified |
| Demo video | Recorded video under 3 minutes; judges score submitted materials, not a live demo | Follow `DEMO_VIDEO_SCRIPT_UNDER_3_MINUTES.md`; show product flow and actual AWS use | Video not recorded/uploaded yet; AWS must be live and shown in the recording |

## Rules that can disqualify the submission

- **Build window:** the rules say old projects do not count. Project work must start after the hackathon opens; rewriting a project begun earlier does not make it eligible. The team must be truthful about the origin of the project and preserve authentic repository history. The file timestamps in this ZIP are not proof of when all project work began.
- **AWS:** use at least one AWS open-source tool or deploy on AWS. The official event page lists OpenSearch under Build It and says the demo must show actual use; mentioning AWS only in the write-up is insufficient.
- **Required deliverables:** public repository, YouTube video under 3 minutes (public or unlisted), and short write-up covering problem, implementation and AWS.
- **Team:** 1–4 university students in India, each 18 or older; every member registers individually. Each member needs the required WeMakeDevs account and AWS Builder Center profile/student verification.
- **One submission per team/person rule:** one submission per team and one team per person per hackathon.
- **Attribution and AI disclosure:** third-party code/assets must be credited and licensed for use. List AI coding tools actually used in the write-up.
- **Deadline:** strict; the submission form closes after the published deadline.

## Recommended judging narrative

1. Lead with a specific coordination failure, not “recycling is a problem” in general.
2. Show one real workflow completely; avoid feature tours that do not establish an outcome.
3. Explain why a shared transaction record and handover evidence add value beyond a directory or chatbot.
4. Show OpenSearch doing real work in the demo (buyer search in ReLoop plus a successful OpenSearch index query), or deploy and demonstrate a real AWS service. Do not claim the local open-source container is an AWS cloud deployment.
5. State limitations honestly and propose how a Pune-area pilot will measure outcomes.

Sources reviewed on 10 October 2026: the official event overview, official rules page and event blog detailing the 11 October 8 PM IST online deadline.

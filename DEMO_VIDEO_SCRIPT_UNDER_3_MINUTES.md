# ReLoop demo video script (target 2:45; hard maximum under 3:00)

**Record only after the app builds and the OpenSearch Build It path is running and verified.** Use synthetic data and synthetic documents. Do not show credentials, personal verification documents, private email, or secret values. Upload to YouTube as Public or Unlisted and test the link in a signed-out browser.

## 0:00–0:18 — The problem

**Voice-over:** “Commercial recyclables are not recovered by awareness alone. A useful batch needs a suitable buyer, an agreed pickup, and a record of what was actually handed over. ReLoop coordinates those steps for businesses, buyers and collectors.”

**Screen:** ReLoop home / one-line workflow. Show the Waste and Energy context.

## 0:18–0:48 — Generator lists material

**Voice-over:** “A business creates a batch, for example cardboard ready for collection, and adds the quantity, unit, condition and location.”

**Screen:** Sign in as the synthetic generator account; create and submit a cardboard batch. Show the confirmation and listing status.

## 0:48–1:12 — Buyer offers

**Voice-over:** “A buyer reviews suitable material and submits an offer. ReLoop records the offer and lets the generator accept or decline it.”

**Screen:** Sign in as synthetic buyer; open the batch and submit an offer. Switch to generator and accept it.

## 1:12–1:42 — Collection and handover proof

**Voice-over:** “The assigned collector records the actual accepted weight and uploads handover evidence. The transaction cannot be marked complete until the required evidence and weight are present.”

**Screen:** Sign in as synthetic collector; record a realistic test weight; upload a clearly marked synthetic image/PDF; complete the handover. Show the resulting status.

## 1:42–2:15 — AWS open-source search (Build It)

**Voice-over:** “ReLoop uses the OpenSearch open-source engine to help buyers discover material batches by material terms, category and locality. The API only searches discoverable listing fields and keeps authorization checks in the application.”

**Screen:** Show the buyer search in ReLoop, the API response reporting `searchEngine: OpenSearch`, and the `reloop-material-batches` index query in OpenSearch. This section is valid only while the local OpenSearch container is actually running and the query succeeds. Do not call it Amazon OpenSearch Service or AWS cloud hosting.

## 2:15–2:38 — Accessibility and accountability

**Voice-over:** “ReLoop offers seven language choices, role-specific workflows, audit records and issue reporting. This is an early prototype, so translation and accessibility coverage are still being audited.”

**Screen:** Switch language, show a translated action, then show the issue reporting or audit view. Avoid claiming complete translation if English remains visible.

## 2:38–2:55 — Close

**Voice-over:** “Our next step is a local pilot with commercial generators, buyers and collectors. We will measure listing-to-offer time, pickup completion, support issues and verified material handovers before making claims about impact.”

**Screen:** Show project name and public repository URL. Finish before 3:00.

## Recording checklist

- Total video duration is below 3 minutes.
- Narration is clear and captions are reviewed.
- Browser is signed out of unrelated accounts; all test data is synthetic.
- OpenSearch portion shows an actual buyer search, the API reporting `OpenSearch`, and a successful OpenSearch query—not only source code.
- If mentioning S3, clearly state it is planned/unverified unless a real AWS upload and authorized retrieval have been tested.
- Public/unlisted YouTube link opens in a signed-out browser.

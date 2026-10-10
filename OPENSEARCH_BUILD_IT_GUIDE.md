# ReLoop + OpenSearch: AWS-eligible Build It path

## Why this is a real product integration

ReLoop buyers need to find recyclable-material batches by material, category, locality, quantity, and description. The API can now use **OpenSearch**, the open-source search and analytics engine listed under the Environmental Hacks Build It options, for full-text/fuzzy discovery. Search results are intersected with the API's current authorized, discoverable batches; evidence files, account credentials, and private verification documents are not indexed. If OpenSearch is unavailable, the API falls back to its built-in search and reports `searchEngine: "built-in"`.

This local OpenSearch mode is not Amazon OpenSearch Service and is not an AWS cloud deployment. It is the official open-source project path described by the hackathon page. Do not claim S3, AWS hosting, or Amazon OpenSearch Service is live unless separately deployed and tested.

## Start the local OpenSearch service

Requirements: Docker Desktop with enough memory for OpenSearch (at least 2 GB available is recommended).

```bash
docker compose -f docker-compose.opensearch-demo.yml up -d
```

Wait for the service:

```bash
curl http://localhost:9200/_cluster/health?pretty
```

Set this variable in the environment used to start ReLoop's API:

```env
RELOOP_OPENSEARCH_URL=http://localhost:9200
```

For PowerShell in the same terminal, before starting the API:

```powershell
$env:RELOOP_OPENSEARCH_URL="http://localhost:9200"
npm run server
```

For the combined local development command, set the variable first, then run `npm run dev`. The API indexes currently discoverable listings when a buyer calls `GET /api/matches`; the index is refreshed from the candidate listing fields for that query.

## Verify the integration

1. Sign in as a buyer in ReLoop and search for a material term such as `cardboard` or a locality.
2. Inspect the response in browser DevTools Network: `/api/matches` should report `searchEngine: "OpenSearch"` when the local service is healthy.
3. Inspect the actual search index:

```bash
curl "http://localhost:9200/reloop-material-batches/_search?pretty"
```

4. Stop OpenSearch and retry. The API should fall back to `searchEngine: "built-in"` instead of breaking buyer discovery.

## Security and production boundaries

- The demo service binds to loopback (`127.0.0.1`) and disables the security plugin only for local development. Never expose this configuration publicly.
- Do not index identity documents, pickup evidence, private user fields, emails, tokens, or credentials.
- For production, use Amazon OpenSearch Service with network access restrictions and IAM/SigV4 authentication; this local no-auth configuration is not production-ready.
- The service uses local Docker resources and may consume substantial memory. Stop it after the demo with:

```bash
docker compose -f docker-compose.opensearch-demo.yml down
```

## Hackathon demo and truthful disclosure

Show the running local OpenSearch health endpoint, perform a buyer material search in ReLoop, and show the `reloop-material-batches` index/query results. State clearly: “ReLoop uses the OpenSearch open-source engine locally for recyclable-material discovery. AWS-managed hosting and S3 evidence storage are planned but not deployed in this demo.”

The official Environmental Hacks rules list OpenSearch under Build It and say the project must use an AWS open-source tool or be deployed on AWS, with the demo showing the use. Confirm the event's latest rules and your project's start-date eligibility before submitting.

# ReLoop hardcoded UI text audit

- Generated: 2026-10-09T17:27:39.000Z
- Source files scanned: src/main.jsx
- Candidate strings: 118

> This is a heuristic backlog, not a claim that every candidate is user-facing or that every user-facing string was detected. Dynamic JSX expressions, server-returned errors, and translations need separate review.

| Source line | Kind | Candidate |
|---:|---|---|
| 48 | jsx-text | reloop |
| 48 | jsx-text | MATERIAL WORKSPACE |
| 52 | message | An account with this email already exists. Sign in with your existing password, or use Forgot password if you cannot remember it. |
| 55 | jsx-text | reloop |
| 55 | jsx-text | MATERIAL WORKSPACE |
| 55 | jsx-text | Language |
| 55 | jsx-text | }{tab==='login'&&!resetToken&& |
| 55 | jsx-text | Your account belongs to one role. You will only see that role's dashboard and actions. Administrator access is available only to provisioned admin accounts. |
| 55 | jsx-text | }{!resetToken&& |
| 55 | jsx-text | (at least {resetToken?'12':'10'} characters) |
| 55 | jsx-text | }{notice&& |
| 55 | jsx-text | }{!resetToken&&tab==='login'&&error.toLowerCase().includes('verify your email')&& |
| 55 | jsx-text | © 2026 ReLoop · Material coordination workspace |
| 55 | aria-label | Language |
| 55 | placeholder | e.g. Northstar Retail |
| 55 | placeholder | you@company.com |
| 77 | message | Choose a JPG, PNG or PDF document first. |
| 77 | message | Choose a file smaller than 6 MB. |
| 77 | message | Document submitted. ReLoop will show the review status here. |
| 80 | jsx-text | :check.status==='rejected'? |
| 80 | jsx-text | :check.status==='in_review'? |
| 81 | jsx-text | JPG, PNG or PDF · up to 6 MB |
| 82 | jsx-text | Submitted |
| 83 | jsx-text | Documents are visible only to authorized ReLoop reviewers. Do not upload unrelated personal information. Actual verification depends on configured email and review providers. |
| 155 | jsx-text | ;return |
| 164 | message | Switched to ${roleMeta[next].label} workspace |
| 171 | message | Offer submitted to the material owner. |
| 171 | message | Offer ${status.toLowerCase()}. |
| 174 | message | This batch is no longer available. Refresh and try again. |
| 183 | message | Offer accepted. ${offer.buyer} has been selected. |
| 184 | message | Offer ${status.toLowerCase()}. |
| 189 | message | Material listing published to the shared workspace. |
| 193 | message | Your material listing is saved in the demo workspace. |
| 197 | message | Demo data restored. |
| 201 | jsx-text | Skip to main content |
| 203 | jsx-text | reloop |
| 203 | jsx-text | MATERIAL WORKSPACE |
| 204 | aria-label | Switch workspace |
| 205 | jsx-text | Switch roles to preview separate journeys. These are not three permissions on one account. |
| 208 | aria-label | Open help |
| 212 | jsx-text | New offer received |
| 212 | jsx-text | Pune Fibre Works made an offer on RL-1042. |
| 212 | jsx-text | Just now · Demo activity |
| 212 | jsx-text | Collection reminder |
| 212 | jsx-text | RL-1039 is scheduled for today. |
| 212 | jsx-text | Today · Demo activity |
| 212 | message | Speech playback is not available in this browser. |
| 215 | aria-label | Dismiss prototype notice |
| 216 | jsx-text | :page==='Verification'&&role!=='admin'? |
| 216 | jsx-text | :page==='Offers'&&role==='generator'? |
| 216 | jsx-text | :page==='Partners'&&role==='admin'? |
| 216 | jsx-text | :page==='Audit log'&&role==='admin'? |
| 216 | jsx-text | :((page==='Report an issue'&&role!=='admin')\|\|(page==='Issues'&&role==='admin'))? |
| 217 | jsx-text | © 2026 ReLoop · Material coordination workspace |
| 217 | jsx-text | Built around clarity, traceability and trust |
| 222 | title | ReLoop help |
| 223 | jsx-text | :role!=='admin'&& |
| 224 | aria-label | Dismiss message |
| 238 | jsx-text | Current workspace records |
| 238 | jsx-text | Open workspace list |
| 238 | aria-label | View more records |
| 239 | jsx-text | :role==='buyer'? |
| 239 | jsx-text | :role==='collector'? |
| 239 | title | Check completed records |
| 239 | title | Browse available material |
| 245 | jsx-text | :type==='plastic'? |
| 247 | jsx-text | tab==='All'\|\|o.status===tab);return |
| 247 | jsx-text | x.id===o.batchId);return |
| 247 | jsx-text | Rates shown here are sample offers. Actual amounts may depend on final accepted weight, condition, transport and agreed terms. |
| 259 | jsx-text | Showing {batches.length} records in this prototype |
| 271 | jsx-text | Corrugated cardboard |
| 271 | jsx-text | Mixed cardboard |
| 271 | jsx-text | Office paper |
| 271 | jsx-text | Mixed paper |
| 271 | jsx-text | PET bottles |
| 271 | jsx-text | Rigid plastic |
| 271 | jsx-text | kg |
| 271 | jsx-text | tonnes |
| 271 | jsx-text | Clean, flattened |
| 271 | jsx-text | Sorted, dry |
| 271 | jsx-text | Mixed, needs sorting |
| 271 | jsx-text | Bundled |
| 271 | jsx-text | Other — describe below |
| 271 | jsx-text | Quantity is an estimate. Final weight and commercial terms should be confirmed during the transaction. |
| 271 | aria-label | Close dialog |
| 271 | aria-label | Quantity unit |
| 271 | placeholder | e.g. Weekdays, 10 AM–4 PM |
| 276 | message | Enter a valid actual weight before completing. |
| 276 | message | Confirm handover evidence before completing. |
| 276 | message | Upload a JPG, PNG or PDF handover file before completing. |
| 276 | message | Batch ${batch.id} updated to ${nextStatus}. |
| 278 | jsx-text | estimated |
| 278 | aria-label | Close batch details |
| 280 | jsx-text | After collection, record the accepted quantity and update the job status. |
| 280 | jsx-text | Upload handover evidence (JPG, PNG or PDF) * |
| 280 | jsx-text | Maximum 6 MB. File is stored with the transaction. |
| 280 | message | Pickup marked as collected. Add the final weight and evidence to complete the record. |
| 280 | message | Enter a valid actual weight. |
| 280 | message | Confirm handover evidence first. |
| 280 | message | Upload handover evidence first. |
| 281 | message | Collector assigned and pickup scheduled. |
| 282 | message | Enter a valid offer rate. |
| 291 | message | Please describe the issue in a few words. |
| 292 | message | Issue ${issue.id} updated. |
| 294 | jsx-text | Your reference: |
| 294 | jsx-text | . Keep this reference if you need to follow up. |
| 294 | aria-label | Dismiss confirmation |
| 295 | placeholder | Describe the issue in your own words. Local language is welcome. |
| 296 | jsx-text | }{loading&& |
| 296 | jsx-text | }{issues.length===0&&!loading? |
| 296 | jsx-text | In review |
| 300 | aria-label | Close dialog |
| 301 | jsx-text | tab==='All partners'\|\|p[1].toLowerCase().includes(tab.slice(0,-1).toLowerCase())\|\|(tab==='Buyers'&&p[1].includes('Buyer')));return |
| 301 | jsx-text | Role |
| 301 | jsx-text | }{rows.length===0&&!loading&& |
| 301 | message | Partner marked ${status}. |
| 302 | jsx-text | ({id:b.id,action:b.status,entityType:'batch',entityId:b.id,details:{material:b.material,seller:b.seller},createdAt:b.date}));return |
| 302 | jsx-text | )}{rows.length===0&&!error&& |

The JSON report contains 118 candidates. Prioritize user-visible controls, errors, validation, statuses, notifications and confirmation messages. Do not translate user-generated business/material content automatically.

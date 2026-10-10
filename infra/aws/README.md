# ReLoop AWS evidence storage (submission integration)

For the complete service-selection rationale, deployment stages, cost guardrails and public-visibility plan, read [`RELOOP_AWS_ARCHITECTURE.md`](./RELOOP_AWS_ARCHITECTURE.md).

ReLoop can store handover photos/documents and business-verification documents in a private Amazon S3 bucket instead of local disk. The backend uses the open-source AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`). The default local development mode remains local disk when `RELOOP_S3_BUCKET` is blank.

## Configure a sandbox AWS account

1. Review the cost and region before deploying. Use a dedicated hackathon sandbox/account.
2. Deploy the private bucket:

   ```bash
   aws cloudformation deploy --template-file infra/aws/evidence-bucket.yaml --stack-name reloop-evidence --region ap-south-1
   aws cloudformation describe-stacks --stack-name reloop-evidence --region ap-south-1 --query "Stacks[0].Outputs"
   ```

3. Copy `EvidenceBucketName` from the output and set `RELOOP_S3_BUCKET` and `AWS_REGION=ap-south-1` in the backend environment.
4. Attach the least-privilege policy from `evidence-access-policy.template.json` to the backend's IAM role after replacing the bucket name. The backend role needs `s3:PutObject` and `s3:GetObject` only for `private/*`. The bucket is private; the API performs participant/administrator authorization before returning files.
5. Install dependencies (`npm install`) and start the server. Upload a valid JPG, PNG or PDF through the ReLoop UI. Confirm the object appears under `private/handover/` or `private/verification/`, with public access blocked and encryption enabled.
6. Download the same file through the authorized ReLoop UI. Confirm an unrelated account cannot download it. Capture the app workflow and the S3 bucket configuration in the hackathon demo video.
7. Check CloudWatch logs for storage errors without logging file contents, session cookies, credentials or signed URLs. Set a budget alert before leaving resources running.

## Security notes

- Do not put AWS access keys in `.env`, source code, screenshots or the public repository. Use an IAM role / task role / instance profile where possible.
- Do not make the bucket public or expose direct object URLs. The API authorizes each download.
- Verification documents may contain sensitive personal or business data. Use synthetic demo documents, restrict access, and define retention/deletion rules before production.
- This CloudFormation template creates the evidence bucket only; it does not deploy the ReLoop frontend, API or database. The current API uploads through Node.js; direct presigned uploads are a future scale-up option, not an implemented feature. It has not been deployed or tested against an AWS account in this workspace.
- AWS charges may apply. Delete the stack and test data after the hackathon if no longer needed.

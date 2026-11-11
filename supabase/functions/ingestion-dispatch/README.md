# ingestion-dispatch

**Invocation:** Signed database webhook when an ingestion job becomes queued  
**Input:** immutable job ID, document ID, workspace ID, idempotency key, correlation ID  
**Action:** validate signature and job status, then relay the job to the Node worker/control-plane queue  
**Output:** acknowledgement only

The Node worker performs scanning, extraction, OCR, chunking, embedding, indexing, retries, and final document status updates. This function never processes file contents.


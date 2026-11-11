# Supabase Edge Functions

Edge Functions remain deliberately narrow under the Phase 1 architecture. Express is the trusted agent/control plane and the Node worker owns long-running parsing, embedding, export, and retry work. Electron main owns native actions.

## Function map

| Function | Invocation | Responsibility | Must not do |
|---|---|---|---|
| storage-upload-authorizer | Authenticated HTTP request | Validate scope and mint a short-lived upload path/URL for a private bucket | Parse files, create embeddings, or use native capabilities |
| ingestion-dispatch | Signed database webhook/event | Validate event shape and relay an idempotent ingestion request to the control-plane queue | Perform extraction/OCR/embedding in the Edge runtime |
| account-erasure-dispatch | Authenticated HTTP request | Record a verified erasure request and dispatch durable cleanup work | Delete data synchronously or bypass audit/retention |
| storage-cleanup-dispatch | Signed worker callback | Authorize removal of expired export/temp objects after durable job completion | Delete arbitrary user objects based on client input |

## Shared requirements

- Authenticate user-facing calls from the Supabase JWT; authenticate internal relays with a distinct webhook secret.
- Validate a versioned JSON contract at the function boundary.
- Propagate a correlation ID and idempotency key.
- Emit only redacted structured logs.
- Return quickly; persist/forward durable work to the Node worker rather than doing long work in the Edge runtime.
- Use service-role credentials only within Edge secret storage and only for the minimum necessary operation.
- Reject requests where the resource workspace is not a membership of the authenticated user.

The contract files inside each function directory are the Phase 2 implementation boundary. Future code must satisfy them without taking on Express, worker, or Electron responsibilities.


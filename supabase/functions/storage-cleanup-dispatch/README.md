# storage-cleanup-dispatch

**Invocation:** Signed control-plane worker callback  
**Input:** completed job/export identifier, storage path, workspace ID, expiry policy, idempotency key  
**Action:** validate the durable job record and remove only the authorized expired temporary/export object  
**Output:** idempotent completion acknowledgement

The storage path is resolved from server-side records. Client-provided paths are never trusted.


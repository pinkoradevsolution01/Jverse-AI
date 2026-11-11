# account-erasure-dispatch

**Method:** POST  
**Authentication:** Supabase user JWT plus current-session reauthentication proof  
**Input:** user ID derived from token, deletion scope, correlation ID  
**Action:** record a consent/audit event and dispatch a durable erasure workflow to the control plane  
**Output:** request ID and status

Erasure remains asynchronous so retention, legal hold, Storage cleanup, vector deletion, and export reconciliation are auditable and recoverable within their defined policy.


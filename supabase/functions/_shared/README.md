# Shared Edge Function contracts

Shared code may contain only request authentication, schema validation, correlation/idempotency helpers, workspace-scope checks, redacted logging, and signed control-plane delivery.

It must not contain agent planning, RAG, model calls, file extraction, database-wide administration, or Electron/native logic.


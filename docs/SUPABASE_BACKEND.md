# JVerse AI — Supabase Backend

This document accompanies the Phase 2 migrations and remains governed by the Phase 1 reference architecture.

## Deployment order

1. Apply all SQL files in lexical order from supabase/migrations.
2. Configure Supabase Auth providers: email/password and Google OAuth. Set the production redirect allowlist before enabling Google.
3. Store Edge Function and control-plane secrets in Supabase/Vercel secret stores, never in web or Electron renderer builds.
4. Deploy Edge Functions only after their contract implementation is reviewed.
5. Configure the signed webhook for ingestion-dispatch and the Node worker queue endpoint.
6. Test RLS using both anonymous and authenticated principals before exposing any table through the client.

## Ownership and relationship model

An Auth user creates one profile, one personal workspace, membership of that workspace, and default settings through the secure auth trigger. A workspace may additionally hold team members.

Conversation and memory data remains owner-private even when it records a workspace ID. Projects, project notes, tasks, documents, chunks, ingestion status, and files are workspace-scoped. Agent runs/actions are owned by the initiating user and linked to the workspace/device when applicable. This preserves personal AI privacy while allowing workspace collaboration.

Uploaded files are metadata for private Storage objects. Knowledge documents version a source file; chunks version a document; embeddings represent chunks or memories and record model plus dimensions. Generic vector storage intentionally does not hardcode embedding dimensions.

## Vector indexing decision

Phase 1 reserves embedding-model selection for an ADR. The schema therefore validates vector dimensions and provides workspace/model metadata plus full-text search, but does not create a potentially invalid fixed-dimension HNSW index.

When that ADR selects one embedding model/dimension, add a separate forward-only migration that creates the appropriate HNSW or IVFFlat index for that fixed vector dimension. Do not alter the generic contract or silently mix dimensions in one index.

## Storage contract

All objects use the canonical tenant-prefixed path:

~~~text
workspace-id/resource-id/original-or-generated-name
~~~

Every bucket is private. Direct user uploads are limited to documents, avatars, voice recordings, project files, knowledge-base files, and images. Exports and deletions are controlled by trusted service paths. Signed URLs are short-lived; permanent public bucket access is prohibited.

## Realtime contract

The migration adds only user-facing state tables to the Supabase Realtime publication:

| Topic | Tables | Client filter |
|---|---|---|
| Chat | conversations, messages | Conversation owner |
| Agent progress | agent runs, agent actions | Run/action owner |
| Project workspace | projects, project notes, tasks | Workspace membership |
| Knowledge progress | knowledge documents, ingestion jobs | Workspace membership |
| User notification | notifications | Recipient user |

RLS is the data authorization layer. The UI additionally filters subscriptions by known workspace, conversation, run, or user IDs; filters are an efficiency control, not authorization. Token streams remain Express Server-Sent Events rather than Realtime rows.

## Operational invariants

- Service-role access is restricted to Express, the Node worker, and narrowly-scoped Edge Functions.
- The database stores redacted action results/audit payloads, not credentials or unrestricted sensitive command output.
- Agent actions must be planned and policy-approved before Electron main receives a short-lived action token.
- Ingestion is idempotent through job keys and durable status transitions.
- User-driven direct writes are limited to safe profile/settings/device/consent, personal conversation/memory, and collaborative project data. Trusted services own agent records, document ingestion state, embeddings, audit events, notification creation, and exports.


# Phase 1 and Phase 2 Integration Validation

**Result:** Connected as designed, with one additive relational-integrity migration added during validation.

## Boundary verification

| Phase 1 decision | Phase 2 implementation | Result |
|---|---|---|
| Supabase is the cloud system of record | Auth, Postgres, pgvector, Storage, Realtime, migrations | Aligned |
| Express is the trusted control plane | Edge contracts delegate orchestration, processing, exports, and retries to Express/Node worker | Aligned |
| Electron main is the only desktop authority | Database records grants/action audit only; no database or Edge native-action capability exists | Aligned |
| Agent is constrained and approval driven | Run/action states, risk tiers, device binding, approval expiry fields, immutable audit data | Aligned |
| Cloud authoritative; desktop is a cache | No local store represented as system of record; ingestion/sync have durable cloud records | Aligned |
| User data is protected by RLS | All 26 public application tables enable RLS; Storage buckets are private | Aligned |
| Realtime is selective | Only chat, agent, project, ingestion, and notification tables enter publication | Aligned |
| Model/embedding choice is an ADR | Generic vector plus dimensions/model/version; no arbitrary fixed-dimension index | Aligned |

## Schema coverage

The schema contains every Phase 1 product table and the additional operational tables mandated by the architecture: workspaces/members, agent runs, knowledge chunks, embeddings, project notes, chat exports, device registrations, capability grants, consents, ingestion jobs, and audit events.

## Integrity correction added

Migration 0009_relational_integrity adds database-side validation that these links use the same owner/workspace:

- message to conversation
- agent run to conversation
- agent action to run and device
- export to conversation
- project notes/tasks to projects and workspace members
- document/chunk/embedding/ingestion job to the source workspace
- memory to source conversation
- capability grant/system configuration to device owner

It also prevents a workspace owner from demoting or removing their own required membership. This is hardening within the approved ownership model; it changes no architectural decision.

## Verified static checks

- 26 application tables created and 26 tables have RLS enabled.
- Every migration is transaction-bounded.
- Realtime publication tables have RLS read policies and replica identity configured.
- All seven mandated private buckets exist in the migration.
- Edge Functions remain contract-only and bounded to the Phase 1 responsibility model.

## Remaining deployment validation

The Supabase CLI and a linked Supabase project are not present in this workspace. Before production, run the migrations in a disposable Supabase project, execute RLS test cases for anonymous/authenticated/member/non-member principals, and validate Realtime delivery under those same principals. This is deployment verification, not an unresolved architecture issue.


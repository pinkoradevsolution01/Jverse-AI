# JVerse AI — Reference Architecture

**Status:** Source-of-truth baseline, amended by ADR-0009
**Scope:** Web, desktop, local AI runtime, cloud data plane, and agent orchestration.  
**Rule:** This is implementation-neutral. It deliberately contains no implementation code.

## 1. Architecture principles

1. **One product, two execution environments.** Next.js delivers the shared product experience; Electron adds privileged desktop features. A browser never gains desktop privileges.
2. **Local-first intelligence, cloud-synced knowledge.** Ollama/Qwen runs locally when available. Supabase is authoritative for identity, synced product data, storage metadata, and cloud knowledge.
3. **Explicit agency.** Models may propose actions. Policy decides if an action is allowed and whether it needs confirmation.
4. **Trusted boundaries.** Browsers receive only the Supabase public key and authenticated session. Service-role access, model credentials, policy evaluation, and OS calls stay trusted.
5. **Modular monolith first.** Build a strongly bounded TypeScript workspace. Extract services only for evidence-backed scale, reliability, or ownership needs.
6. **Observable and reversible.** Runs, approvals, tool calls, and state changes are traceable. Consequential actions are cancellable, expiry-bound, and audited.
7. **Progressive enhancement.** Web supports chat, projects, cloud knowledge, and settings; native actions, local models, wake word, and telemetry require desktop mode.

## 2. Complete system architecture

### JARVIS local-brain amendment (ADR-0009)

The following authority model supersedes any conflicting Node/browser-voice wording in this document:

| System | JARVIS responsibility | Authority boundary |
|---|---|---|
| Python brain | Intent, planning, safety, retrieval orchestration, streaming, run lifecycle | Trusted service; never rendered in the browser |
| Ollama + Qwen 2.5 | Local reasoning and generation | Local model runtime; never browser-reachable |
| Electron main | Hands and eyes: OS actions, local model bridge, microphone/speaker lifecycle, screen-capability adapters | Sole privileged device authority |
| Supabase | Identity, durable memory, conversations, knowledge, audit, sync | Cloud source of truth with RLS |
| Whisper + Piper | Local STT and TTS | Electron-owned local voice runtime; raw audio stays local by default |
| Next.js | Interface: chat, visual state, approvals, controls | Untrusted presentation/BFF surface |

The existing TypeScript Express control plane and browser speech APIs are transitional compatibility implementations. They must be removed from the production path after the Python brain and Electron voice adapters meet the replacement acceptance tests in ADR-0009.

### Logical layers

| Layer | Components | Responsibility | Trust |
|---|---|---|---|
| Presentation | Next.js 15, Tailwind, shadcn/ui, Framer Motion, React Three Fiber | Chat, dashboard, projects, settings, voice UI, AI-core visualization | Untrusted client |
| Client state | TanStack Query, Zustand stores | Remote cache and ephemeral interaction state | Untrusted client |
| Web gateway | Next.js BFF routes/server actions | SSR and narrow session-aware presentation endpoints | Trusted server |
| Control plane | Python + FastAPI | Orchestration, policy, retrieval, ingestion, exports, integrations | Trusted server |
| Cloud platform | Supabase Auth, Postgres/pgvector, Storage, Realtime, Edge Functions | Identity, durable data, vectors, files, database-triggered work | Managed trusted |
| Local intelligence | Ollama, Qwen 2.5 default, Whisper STT, Piper TTS | Generation, transcription, synthesis, offline work | Trusted local |
| Desktop shell | Electron main/preload/renderer | Lifecycle plus capability bridge | Privileged local |
| OS adapters | Apps, files, system, notifications, voice | Validated native operations | Privileged local |
| Operations | Audit events, logs, metrics | Safety, reliability, support, quality | Trusted only |

### Deployment topology

~~~mermaid
flowchart TB
  Browser[Web browser / Next.js client] --> Next[Next.js 15 on Vercel]
  Desktop[Electron renderer / shared UI] --> Preload[Context-isolated preload bridge]
  Preload --> Main[Electron main process]
  Desktop --> Next
  Next --> API[Express control-plane API]
  Main --> Local[Local agent runtime]
  Local --> Ollama[Ollama / Qwen 2.5 or Llama 3]
  Main --> OS[Operating system / apps files telemetry]
  API --> Supa[Supabase / Auth Postgres pgvector Storage Realtime]
  Next --> Supa
  API --> Supa
  Local <--> API
~~~

Deploy Next.js to Vercel, Supabase as managed data services, the Python brain as a long-running service, and Electron through Electron Builder. Web must never depend directly on Electron, a local Ollama server, Whisper, or Piper.

### Runtime capability matrix

| Capability | Web | Desktop online | Desktop offline |
|---|---:|---:|---:|
| Auth, chat, projects | Yes | Yes | Cached/read-only unless queued |
| Cloud RAG and synced memory | Yes | Yes | Locally indexed subset only |
| Ollama/Qwen inference | No | Yes | Yes |
| OS actions and telemetry | No | Yes | Yes, policy-bound |
| Native files/workspaces | Browser-limited | Yes | Yes |
| Realtime multi-device sync | Yes | Yes | Queued until reconnect |
| Wake word | No | Yes | Yes, local engine required |

### Authority boundary

~~~mermaid
flowchart LR
  User --> UI[UI request]
  UI --> Orchestrator[Agent orchestrator]
  Orchestrator --> Policy[Policy and consent gate]
  Policy -->|Read/search allowed| Tool[Scoped tool adapter]
  Policy -->|Sensitive or mutating| Confirm[User confirmation]
  Confirm -->|Approved| Tool
  Confirm -->|Denied or expired| Result[Safe explanation]
  Tool --> Audit[Action audit]
  Tool --> Result
  Result --> UI
~~~

The model cannot call the OS, service-role database APIs, or integrations directly. It emits only typed tool proposals. The orchestrator verifies schema, identity, capability grant, allowlist, confirmation, rate limits, target scope, and desktop availability before execution.

## 3. Repository structure

~~~text
jverse-ai/
├─ apps/
│  ├─ web/                    # Next.js UI and BFF surface
│  │  ├─ app/                 # Routes, layouts, narrow UI API routes
│  │  ├─ features/            # Screen-level feature composition
│  │  ├─ components/          # Shared UI, visual system, R3F scenes
│  │  ├─ hooks/
│  │  ├─ stores/              # Zustand UI/ephemeral state only
│  │  ├─ lib/                 # Browser-safe utilities and clients
│  │  └─ styles/
│  ├─ desktop/                # Electron application
│  │  ├─ main/                # Window, tray, updater, permissions
│  │  ├─ preload/             # Typed minimal capability bridge
│  │  ├─ renderer/            # Hosts/reuses shared presentation
│  │  ├─ ipc/                 # IPC registration and validation
│  │  ├─ adapters/            # OS-specific app/file/system/voice adapters
│  │  ├─ local-runtime/       # Ollama, local index, offline outbox
│  │  └─ resources/
│  ├─ api/                    # Express control plane
│  │  ├─ modules/
│  │  ├─ agent/
│  │  ├─ jobs/
│  │  ├─ middleware/
│  │  └─ integrations/
│  └─ worker/                 # Durable background jobs
├─ packages/
│  ├─ contracts/              # DTOs, events, tool schemas, errors
│  ├─ domain/                 # Framework-independent business rules
│  ├─ ui/                     # Shared shadcn-derived components/tokens
│  ├─ ai-core/                # Prompts, model ports, retrieval/ranking
│  ├─ security/               # Policy/capability/redaction contracts
│  ├─ config/
│  └─ test-kit/
├─ supabase/
│  ├─ migrations/             # Schema, RLS, indexes, functions
│  ├─ functions/              # Focused Edge Functions
│  ├─ seed/
│  └─ config/
├─ docs/
│  ├─ JVERSE_AI_ARCHITECTURE.md
│  ├─ adr/
│  ├─ api/
│  ├─ threat-model/
│  └─ runbooks/
├─ tooling/
└─ .github/
~~~

Rules: Apps depend on packages, packages never depend on apps. UI cannot import Node or Electron APIs; it uses typed web/desktop ports. Preload exposes named capabilities, never generic IPC, Node globals, or filesystem access. Domain packages hold business invariants; vendors/platforms are adapters. Cross-process contracts are versioned before use.

## 4. Feature modules

| Module | Scope | Primary data/integrations |
|---|---|---|
| Identity and profile | OAuth, password auth, sessions, profile, device registration | Supabase Auth, profiles, settings |
| Conversation | Streaming chat, threads, search, saves, export, rich messages | conversations, messages, exports |
| Agent workspace | Plans, progress, approvals, tool result UI | agent runs/actions, policy engine |
| Memory | Preferences, instructions, durable facts, user controls | memories, embeddings, consent |
| Knowledge base | Upload, ingest, semantic search, document chat | Storage, files, documents, chunks/vectors |
| Projects | Projects, notes, tasks, milestones, project context | projects, notes, tasks |
| Developer assistant | Code help and approved workspace context | agent tools, local workspace adapter |
| Voice | Push-to-talk, STT/TTS, voice profile, wake-word readiness | voice profiles, optional protected recordings |
| Desktop control | Apps/files/folders, tray, startup, metrics | Electron IPC, local grants |
| Dashboard | Status, recent work, analytics, timeline | Read models from module events |
| Notifications | In-app/native delivery and read state | notifications, Realtime, Electron |
| Settings/privacy | Models, retention, permissions, export/delete | settings, consents, grants |
| Observability/admin | Health, diagnostics, audit investigation | redacted audit/event records |

A module owns its use cases, authorization, contracts, repository port, UI composition, and tests. It does not directly write another module’s data.

## 5. Service layers

| Layer | Examples | Required responsibility | Prohibited responsibility |
|---|---|---|---|
| Interface | Pages, command palette, voice orb | Render and collect user intent | Authorization or secrets |
| Application | Send message, search knowledge, execute action | Coordinate use cases, transactions, events | Vendor SDK details |
| Domain | Conversation, Memory, Project, ActionPolicy | Business invariants/lifecycle | HTTP, Electron, Supabase calls |
| AI orchestration | Planner, context builder, tool executor | Constrained planning, streaming, tool lifecycle | Policy bypass |
| Infrastructure | Supabase/Ollama/Electron adapters | Translate ports to platform calls | Product decision making |
| Platform | Auth, queues, monitoring, secrets | Secure operation | Direct unguarded UI access |

Core services: IdentityService resolves principal/workspace/device. ConversationService persists threads and response streams. AgentRunService creates cancellable lifecycle records. ContextService builds authorized bounded context. RetrievalService filters/retrieves/reranks/cites chunks. MemoryService proposes/deduplicates/retrieves/corrects/expires/deletes memory. ActionPolicyService evaluates risk, grants, scope, confirmation. DesktopCapabilityService validates device state. IngestionService scans/extracts/chunks/embeds/indexes. SyncService reconciles cloud/local changes idempotently.

| Path | Protocol | Use |
|---|---|---|
| UI to BFF/API | HTTPS JSON | Commands, queries, pagination |
| Agent to UI | Server-Sent Events | Token stream and typed lifecycle events |
| UI to Supabase | Authenticated client/Realtime | RLS-safe reads and subscriptions |
| Renderer to Electron main | Typed invoke/response IPC | Explicit desktop capabilities |
| Main to local runtime/Ollama | Local HTTP/internal contract | Local models and offline work |
| API to worker | Durable job/event queue | Ingestion, embeddings, exports, retry |

Direct Supabase client access is only for RLS-protected user data and Realtime. Service-role work, secrets, policy, file processing, and orchestration use API/worker layers.

## 6. Data architecture

| Data | Authority | Requirement |
|---|---|---|
| Identity/sessions | Supabase Auth | Auth user ID is global principal |
| Account/product data | Supabase Postgres | Owner/workspace scope and RLS |
| Files | Supabase Storage | Metadata/status/checksum in Postgres |
| Semantic vectors | Postgres pgvector | Content/model/version separated |
| Agent/audit history | Append-only Postgres events | No secrets/raw sensitive output by default |
| Offline cache/index/outbox | Encrypted Electron app data | Cache, never cloud truth |
| UI state | Query cache/Zustand | Disposable, non-authoritative |

~~~mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : has
  PROFILES ||--o{ CONVERSATIONS : owns
  CONVERSATIONS ||--o{ MESSAGES : contains
  PROFILES ||--o{ MEMORIES : owns
  PROFILES ||--o{ PROJECTS : owns
  PROJECTS ||--o{ TASKS : contains
  PROJECTS ||--o{ PROJECT_NOTES : contains
  PROFILES ||--o{ UPLOADED_FILES : uploads
  UPLOADED_FILES ||--o| KNOWLEDGE_DOCUMENTS : becomes
  KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_CHUNKS : splits_into
  KNOWLEDGE_CHUNKS ||--o{ EMBEDDINGS : represented_by
  CONVERSATIONS ||--o{ AGENT_RUNS : initiates
  AGENT_RUNS ||--o{ AGENT_ACTIONS : proposes
  PROFILES ||--o{ DEVICE_REGISTRATIONS : uses
  PROFILES ||--o{ NOTIFICATIONS : receives
~~~

The product’s core tables are profiles, conversations, messages, memories, knowledge documents, projects, tasks, settings, voice profiles, notifications, activity logs, agent actions, uploaded files, and system configurations. Required supporting tables are agent runs, knowledge chunks, embeddings, project notes, chat exports, device registrations, capability grants, consents, ingestion jobs, and audit events.

Every user-owned table carries ID, timestamps, owner/workspace scope, RLS, query-aligned indexes, and retention rules. High-volume events use partitioning and deliberate retention.

RLS/storage policy: deny by default; enforce ownership in RLS and application policy; restrict service role to APIs/workers; tenant-prefix private storage paths; issue short-lived signed URLs; inherit document permissions into chunks/vectors; remove revoked/deleted sources from retrieval. Voice recording defaults off and requires consent, encryption, retention, export, and deletion controls.

## 7. Data-flow diagrams

### Text chat and agent response

~~~mermaid
sequenceDiagram
  participant U as User
  participant UI as Next/Electron UI
  participant API as Agent API
  participant C as Context service
  participant R as Memory/RAG
  participant M as Ollama Qwen
  participant DB as Supabase
  U->>UI: Send message
  UI->>API: Create authenticated agent run
  API->>DB: Persist user message and run
  API->>C: Build bounded authorized context
  C->>R: Retrieve memories and cited chunks
  R->>DB: Scoped vector/keyword query
  API->>M: Prompt + context + allowed tool schemas
  M-->>API: Tokens or typed tool proposal
  API-->>UI: SSE tokens and run events
  API->>DB: Persist output, citations, provenance
  API-->>UI: Completed status
~~~

### Knowledge ingestion and retrieval

~~~mermaid
flowchart LR
  Upload[Authenticated upload] --> Storage[Private Storage]
  Upload --> FileRow[File record pending]
  FileRow --> Job[Ingestion job]
  Job --> Scan[Type size security scan]
  Scan --> Extract[Text extraction or OCR]
  Extract --> Chunk[Semantic chunking and metadata]
  Chunk --> Embed[Embedding provider]
  Embed --> Index[Chunks plus pgvector]
  Index --> Ready[Document ready]
  Query[Chat/query] --> Filter[RLS and document scope filter]
  Filter --> Vector[Vector plus keyword retrieval]
  Vector --> Rank[Rerank/deduplicate]
  Rank --> Cite[Bounded cited context]
~~~

Ingestion is asynchronous and idempotent. Versions record parser, chunking, and embedding models. Retrieval has a context budget and returns citations. Retrieved material never becomes durable memory automatically.

### Desktop action execution

~~~mermaid
sequenceDiagram
  participant User
  participant UI as Renderer
  participant API as Agent orchestrator
  participant Policy as Policy gate
  participant Main as Electron main
  participant OS as OS adapter
  participant Audit as Audit store
  User->>UI: Open VS Code
  UI->>API: Intent request
  API->>Policy: Validate tool target/device grant
  Policy-->>UI: Approval required if applicable
  User->>UI: Approve
  UI->>Main: Typed approved-action IPC
  Main->>Main: Revalidate token and expiry
  Main->>OS: Launch allowlisted application
  OS-->>Main: Result
  Main-->>UI: Result event
  Main->>Audit: Outcome target class timestamps
~~~

Cloud orchestration plans/authorizes; only Electron main performs native actions. Approval tokens are single-use, user/device/capability-bound, and short-lived.

### Cloud/local synchronization

~~~mermaid
flowchart LR
  Local[Desktop local store] --> Queue[Encrypted outbox / idempotency key]
  Queue --> Sync[Sync service]
  Sync --> Cloud[Supabase source of truth]
  Cloud --> Delta[Realtime or delta cursor]
  Delta --> Local
  Local --> Resolve[Version/conflict resolver]
  Resolve --> UI[Updated UI]
~~~

Messages merge append-only. Mutable settings may be last-write-wins; meaningful notes/tasks use version checks and user-visible conflict handling.

## 8. AI agent architecture

JVerse uses one constrained orchestrator with specialized, bounded roles, not autonomous unrestricted agents. Qwen 2.5 is default local reasoning. Model routing chooses an available permitted model according to task, latency, privacy preference, device health, and user choice. Llama 3 is an alternate adapter, not a separate system.

~~~mermaid
flowchart TD
  I[Text or voice input] --> N[Normalize]
  N --> Intent[Intent and risk classifier]
  Intent --> Context[Authorized context assembly]
  Context --> Planner[Constrained planner]
  Planner --> Decide{Answer or tool}
  Decide -->|Answer| Model[Model runtime]
  Decide -->|Tool proposal| Validate[Schema authorization policy]
  Validate --> Confirm{Consent needed}
  Confirm -->|Yes| Approval[User approval]
  Approval --> Execute[Scoped tool executor]
  Confirm -->|No| Execute
  Execute --> Observe[Tool result/error]
  Observe --> Model
  Model --> Verify[Grounding and safety checks]
  Verify --> Stream[Stream answer/citations]
  Stream --> Learn[Optional memory candidate]
  Learn --> Gate[Consent confidence dedupe]
~~~

Run lifecycle: created → contextualizing → planning → awaiting approval or executing → synthesizing → completed, failed, cancelled, or expired. State changes are evented. Long work shows progress and supports cancellation; cancelled work never continues unless explicitly submitted as a durable job.

| Role | Output | Constraint |
|---|---|---|
| Router | Intent, route, risk | Never executes tools |
| Context builder | Token-bounded context | Privacy/RLS filters before model |
| Planner | Structured plan/tool proposal | No shell/direct OS access |
| Retrieval specialist | Ranked cited snippets | Read-only; provenance required |
| Desktop specialist | Typed action request | Allowlisted local adapters only |
| Developer specialist | Code/context response or scoped workspace action | Explicit folder scope |
| Memory curator | Save/update/ignore recommendation | Never persists sensitive inferred facts |
| Response synthesizer | User-facing answer | Separates result, source, inference |

| Tier | Examples | Default policy |
|---|---|---|
| 0 Informational | Explain, summarize, authorized knowledge search | Auto-execute |
| 1 Local read | System metrics, list approved files | Capability grant plus scope disclosure |
| 2 Reversible | Open app/site/folder, draft task, notification | First-use/session confirmation or user setting |
| 3 Impactful | Close app, edit file, delete task, startup change | Confirm every action |
| 4 External/irreversible | Send message, delete files, security changes | Explicit just-in-time confirmation; unsupported initially |

Initial scope excludes arbitrary shell execution. Files are never sent to cloud models unless the user permits the source and runtime. Prompt controls version instructions/model/tool definitions/evaluations, label context origins, treat retrieved content as untrusted data, validate tool output, require citations for knowledge answers, and capture privacy-safe traces.

## 9. Electron integration plan

| Process | Owns | Must not own |
|---|---|---|
| Main | Windows, tray, updater, secure store, token validation, native adapters, local runtime lifecycle | Rendering remote content with Node privilege |
| Preload | Minimal typed bridge | Generic IPC, Node modules, filesystem exposure |
| Renderer | Shared UI, approval UX, voice/orb visuals | Native calls, service-role secrets |
| Local runtime | Ollama health/model work, local index, offline queue | Public unrestricted API or UI |

Expose versioned namespaces: apps, files, system, notifications, voice, memory, and ai.

Every IPC operation has input/output schemas, required capability grant, risk tier, platforms, audit event, timeout, cancellation behavior, and user-facing errors. Electron main validates independently.

Security defaults: context isolation on, sandboxed renderer, node integration off, restrictive navigation/window-open policy, strict CSP, signed releases, verified auto-update, secure storage, and least-privilege OS access.

## 10. UI architecture

~~~text
AppShell
├─ GlobalCommandPalette
├─ NavigationRail / ResponsiveSidebar
├─ MainWorkspace
│  ├─ Dashboard
│  ├─ ChatWorkspace
│  │  ├─ ConversationList
│  │  ├─ MessageTimeline
│  │  ├─ Composer / VoiceControl
│  │  ├─ AgentRunPanel
│  │  └─ ApprovalSheet
│  ├─ KnowledgeWorkspace
│  ├─ ProjectsWorkspace
│  ├─ DeveloperWorkspace
│  └─ SettingsPrivacyWorkspace
├─ DesktopStatusBar (desktop only)
├─ NotificationCenter
└─ AICoreScene (React Three Fiber)
~~~

shadcn/ui is the accessible primitive base; Tailwind tokens define the visual system; Framer Motion handles interaction. The 3D AI core is progressive enhancement with a static/reduced-motion fallback. It observes only idle, listening, thinking, processing, speaking, and error states and never blocks core work.

## 11. Security, privacy, and operations

- Supabase Auth is session authority; validate JWTs at every API boundary.
- Use strict RLS, validation at browser/API/job/model/IPC/adapter boundaries, CSP, output encoding, CSRF protection, and rate limits.
- Store secrets only in managed secret stores or Electron secure storage; never ship service-role or provider keys.
- Classify public, account-private, sensitive personal, local-device-only, and secret data; define retention/deletion before launch.
- Propagate correlation IDs through UI, API, workers, and desktop.
- Monitor first-token/complete latency, retrieval latency, tool success, approval rate, ingestion status, sync lag, crash-free sessions, and auth/RLS denials.
- Retry only idempotent operations; outbox/job messages carry idempotency keys and dead-letter state.
- Health checks cover API, worker, Supabase, Ollama, and desktop capabilities.
- Back up Postgres/storage and rehearse restore and desktop-update rollback.

## 12. Development roadmap

| Phase | Outcome | Exit criteria |
|---|---|---|
| 0 Foundations | Workspace, CI, environments, tokens, ADRs, threat model | Quality checks pass; no secret exposure; contracts approved |
| 1 Secure core | Auth, profile, RLS, shell, persistent streaming chat | Sign-in/chat/history works under tested RLS |
| 2 Desktop/local AI | Secure Electron, Ollama health/selection, AI-core UI | Local Qwen works; no renderer Node privileges; offline state clear |
| 3 Knowledge/memory | Upload, ingestion, pgvector RAG, cited answers, memory controls | Search cited; memories reviewable/deletable |
| 4 Safe actions | Planner, approvals, audit, app/file/system adapters | Allowlisted native action handles approval/deny/cancel/failure |
| 5 Productivity | Projects, tasks, developer context, dashboard, Realtime sync | Cross-device workflows converge correctly |
| 6 Voice/polish | Push-to-talk, STT/TTS, stateful orb, accessibility/performance | Consent-based voice and reduced-motion accepted |
| 7 Release hardening | Security/load tests, signing/updater, backups/runbooks, telemetry | Rollback/recovery/incident readiness verified |

Phase gates: no desktop capability without IPC schema, policy tier, allowlist, consent copy, audit event, and negative tests; no table without migration/index/RLS/ownership/retention/policy tests; no agent tool without schema, injection tests, failure behavior, and observability; no visual effect if it harms readability, motion preferences, mobile viability, or performance budgets.

## 13. Locked decisions

1. Supabase Postgres with pgvector is the initial product and semantic-search source of truth.
2. Ollama is a local runtime adapter, never a browser dependency. Qwen 2.5 is default; model/version is recorded per run.
3. Python/FastAPI is the trusted brain and control plane; Next.js is the web experience and narrow BFF. The Node/Express service is a temporary compatibility adapter only.
4. Electron main is the sole desktop authority behind narrow typed versioned IPC.
5. The agent is constrained and approval-driven, never an autonomous shell/OS actor.
6. Cloud state is authoritative; local state is an encrypted cache/offline workspace with idempotent sync.
7. Modules own use cases/contracts; UI, platform, and vendor work are adapters.
8. Material architecture changes require an ADR with rationale, contracts, rollout, security impact, and rollback.

## 14. First ADRs

1. Workspace tooling and package-boundary enforcement.
2. Auth/session flow across Next.js, Express, Supabase, and Electron.
3. Desktop pairing/device registration and action-token design.
4. Local/cloud model routing, privacy semantics, and embedding choice.
5. Memory consent, correction, retention, and deletion.
6. RAG parser/chunk/embedding lifecycle and document versioning.
7. Offline encryption, sync conflicts, and supported offline scope.
8. Telemetry vendor, redaction, retention, and user controls.


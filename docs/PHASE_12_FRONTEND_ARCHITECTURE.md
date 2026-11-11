# Phase 12 — Frontend Architecture

**Status:** Source of truth; structure only, no feature logic.

## 1. Boundary

Next.js is the interface and narrow authenticated BFF. Supabase is used directly only for Auth, RLS-safe reads, and Realtime. The Python brain is reached only through versioned Next BFF routes. Electron is reached only through the typed preload bridge. Browser code never calls local Ollama, Whisper, Piper, Python internals, generic IPC, or a service-role database API.

```text
Route/page → feature composition → query or action port
  ├─ Supabase: Auth, RLS reads, Realtime
  ├─ Next BFF: Python brain commands and SSE
  └─ Electron: named desktop capabilities
```

## 2. Routing structure

```text
app/
├─ layout, global-error, not-found
├─ (public)/
│  ├─ page
│  └─ auth/{sign-in,sign-up,callback,recovery,auth-error}
├─ (protected)/
│  ├─ layout
│  ├─ dashboard
│  ├─ chat/[conversationId]
│  ├─ knowledge/[documentId]
│  ├─ projects/[projectId]
│  ├─ developer, notifications
│  └─ settings/{profile,privacy,models,devices,appearance}
└─ api/{auth,brain,desktop}
```

The URL owns route identity, selected conversation/project/document, filters, sort, and pagination. Zustand never duplicates these values.

## 3. Layout and components

```text
RootLayout
└─ GlobalProviders
   ├─ theme + motion
   ├─ QueryClient
   ├─ Zustand presentation stores
   ├─ session-aware boundary
   └─ toast/live-announcement region
      └─ ProtectedLayout → AppShell
         ├─ AppSidebar + WorkspaceHeader
         ├─ DesktopStatusStrip
         ├─ MainContentFrame → route page
         └─ GlobalOverlays
```

Feature folders own domain composites, query descriptors, BFF action descriptors, browser-safe schemas, and local interaction state. Shared UI, shell, tokens, and providers are never redefined in a feature.

## 4. State management

| State | Owner | Examples |
|---|---|---|
| URL | Next App Router | route params, filters, selected thread |
| Session | Supabase SSR/Auth | verified session, cookie refresh |
| Server state | React Query | conversations, messages, documents, device projection |
| Live updates | React Query + Supabase Realtime | scoped cache patch/invalidation |
| Presentation | Zustand | sidebar, drawer, command palette, shell banners |
| Local interaction | React state/reducer | draft, disclosure, temporary selection |
| Desktop status | typed Electron port + React Query | connected, model/voice availability |

Zustand contains no JWT, refresh token, remote records, permission decision, agent state, or Electron secret. React Query owns request lifecycle, cache, retries, invalidation, and approved reversible optimistic updates.

## 5. API integration strategy

| Target | Frontend path | Authentication | Constraint |
|---|---|---|---|
| Supabase Auth | SSR/browser adapter | Supabase session | PKCE/cookie flow only |
| Supabase data | browser/server port | RLS session | no service role in client |
| Supabase Realtime | subscription adapter | RLS session | named query keys only |
| Python brain | `/api/brain/*` BFF | verified Supabase principal | versioned JSON/SSE contracts |
| Electron | `window.jverseDesktop` port | trusted renderer + main validation | named capability only |

The BFF validates session and request shape, adds correlation IDs, normalizes errors, and forwards SSE. The Python brain performs final JWT, workspace, policy, and tool checks. Electron main independently validates capabilities.

Canonical query keys are `["profile", userId]`, `["workspace", workspaceId]`, `["conversations", workspaceId, filters]`, `["conversation", id]`, `["messages", conversationId]`, `["knowledge", workspaceId, filters]`, and `["desktop", "capabilities"]`.

## 6. Error handling

| Failure | Boundary | UI recovery |
|---|---|---|
| unauthenticated | middleware/protected layout | safe sign-in redirect |
| route failure | route error boundary | retry and correlation ID |
| query failure | feature query boundary | inline retry, preserve safe prior data |
| brain stream failure | stream boundary | mark partial response; retry/new run |
| RLS denial | repository/BFF | access-denied state, no policy detail |
| Electron/voice unavailable | typed desktop boundary | explain desktop requirement/reconnect |

Public categories are `unauthenticated`, `forbidden`, `not_found`, `validation`, `conflict`, `rate_limited`, `offline`, `unavailable`, and `unexpected`. Raw database/provider errors, secrets, paths, and stack traces never enter the UI.

## 7. Folder structure

```text
app/                 # routes, layouts, BFF boundaries
components/          # ui, shell, feedback, desktop presentation
features/            # auth, chat, agent, memory, knowledge, projects, voice, settings
lib/
├─ supabase/         # browser/server/middleware clients
├─ brain/            # BFF client, SSE parser, contracts
├─ electron/         # typed optional bridge adapter
├─ query/            # QueryClient, keys, errors
├─ navigation/
└─ observability/
stores/              # shell, overlays, presentation preferences only
types/generated/     # generated Supabase types only
```

## 8. Adoption gates

- No route bypasses Phase 3 protection.
- No component directly calls Python, Electron, or a service-role API.
- Every query/mutation has stable keys and loading, empty, error, and unavailable states.
- Every Electron capability has a typed port, user-visible availability, main validation, and Phase 10 policy path.
- Every Python command is authenticated, versioned, correlation-ID tagged, and defines JSON/SSE/error behavior.
- This phase adds architecture only; no feature logic is authorized.

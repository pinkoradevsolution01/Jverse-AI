# Phase 5 — Application Shell Architecture

**Status:** Shell-only implementation specification  
**Governing sources:** Phases 1–4 approved blueprints  
**Scope:** Next.js App Router structure, shared layouts, responsive navigation/sidebar, dashboard composition, and Zustand UI-state boundaries.  
**Out of scope:** Business use cases, data fetching, API calls, agent execution, chat behavior, mutations, Supabase queries, and Electron native actions.

## 1. Shell principles

1. **The URL owns navigation state.** Current route, selected conversation, selected project, document, and settings section are route segments/parameters—not Zustand state.
2. **Layouts own persistent chrome.** Sidebar, top workspace bar, command trigger, notification trigger, and overlay mount point survive navigation inside the protected route tree.
3. **Pages own route content.** A page composes the appropriate feature shell/pattern but does not redefine app chrome.
4. **Zustand owns client UI state only.** It holds ephemeral presentation and interaction state, never identity, JWTs, permissions, remote records, or business truth.
5. **Responsive behavior is primarily CSS.** Breakpoints and visual layout use Tailwind. Zustand only records an explicit user interaction, such as opening a mobile drawer.
6. **The shell is data-light.** It renders safely with structural placeholders and leaves future data to page-level feature modules, preserving Next layout stability.
7. **Desktop is progressive enhancement.** Web and Electron use the same protected shell. A small desktop-only status strip can render after the secure desktop bridge reports capability state.

## 2. App Router structure

~~~text
apps/web/app/
├─ layout.tsx                         # One root: html/body, fonts, global styles, global providers
├─ global-error.tsx                   # Last-resort application error boundary
├─ not-found.tsx                      # Global unknown-route response
├─ middleware.ts                      # Phase 3 route protection and session refresh boundary
├─ (public)/
│  ├─ layout.tsx                      # Minimal public/auth shell, no application sidebar
│  ├─ page.tsx                        # /
│  ├─ auth/
│  │  ├─ sign-in/page.tsx             # /auth/sign-in
│  │  ├─ sign-up/page.tsx             # /auth/sign-up
│  │  ├─ forgot-password/page.tsx
│  │  ├─ reset-password/page.tsx
│  │  ├─ verify-email/page.tsx
│  │  └─ auth-error/page.tsx
│  ├─ auth/callback/route.ts          # Phase 3 PKCE callback endpoint
│  └─ desktop/handoff/page.tsx        # Phase 3 system-browser handoff confirmation
├─ (protected)/
│  ├─ layout.tsx                      # Authenticated AppShell and shared overlays
│  ├─ error.tsx                       # Recoverable protected-shell failure
│  ├─ loading.tsx                     # Shell-safe initial placeholder only
│  ├─ dashboard/
│  │  └─ (overview)/
│  │     ├─ page.tsx                  # /dashboard
│  │     ├─ loading.tsx               # Dashboard skeleton only
│  │     └─ error.tsx                 # Dashboard-local recovery
│  ├─ chat/
│  │  ├─ page.tsx                     # /chat
│  │  ├─ [conversationId]/page.tsx    # /chat/:conversationId
│  │  ├─ loading.tsx
│  │  └─ not-found.tsx
│  ├─ knowledge/
│  │  ├─ page.tsx                     # /knowledge
│  │  └─ [documentId]/page.tsx        # /knowledge/:documentId
│  ├─ projects/
│  │  ├─ page.tsx                     # /projects
│  │  └─ [projectId]/page.tsx         # /projects/:projectId
│  ├─ developer/
│  │  └─ page.tsx                     # /developer
│  ├─ notifications/
│  │  └─ page.tsx                     # /notifications
│  └─ settings/
│     ├─ layout.tsx                    # Settings subnavigation and content frame
│     ├─ page.tsx                      # /settings
│     ├─ profile/page.tsx
│     ├─ privacy/page.tsx
│     ├─ models/page.tsx
│     ├─ devices/page.tsx
│     └─ appearance/page.tsx
└─ api/
   └─ auth/                            # Phase 3 routes only; no feature/business API routes in this phase

apps/web/
├─ components/shell/
│  ├─ app-shell/
│  ├─ app-sidebar/
│  ├─ workspace-header/
│  ├─ mobile-navigation/
│  ├─ desktop-status-strip/
│  ├─ global-overlays/
│  └─ route-transition/
├─ components/dashboard/
│  ├─ dashboard-shell/
│  ├─ priority-region/
│  ├─ status-strip/
│  └─ widget-grid/
├─ stores/
│  ├─ shell-store/
│  ├─ overlay-store/
│  └─ store-provider/
└─ lib/navigation/
   ├─ navigation-model/
   ├─ route-matcher/
   └─ safe-return-path/
~~~

Route groups organize responsibilities without adding URL segments. The application has one root layout, so moving from public/auth into the protected workspace does not create conflicting route paths or unnecessary multiple-root-layout behavior.

## 3. Layout hierarchy

~~~text
RootLayout
├─ Document configuration
├─ JVerse token/theme boundary
├─ Global Motion configuration
├─ Session-aware provider boundary
├─ Zustand StoreProvider
├─ Toast/announcement region
└─ Route group
   ├─ PublicLayout
   │  ├─ Minimal brand header
   │  └─ Public/auth content
   └─ ProtectedLayout
      └─ AppShell
         ├─ DesktopStatusStrip (desktop capability only)
         ├─ AppSidebar
         ├─ WorkspaceHeader
         ├─ MainContentFrame
         │  └─ Route page
         └─ GlobalOverlays
            ├─ Command palette
            ├─ Mobile navigation sheet
            ├─ Notification sheet
            └─ Connectivity/status banner
~~~

### Layout responsibilities

| Layout/component | Owns | Does not own |
|---|---|---|
| RootLayout | HTML/body, fonts, global token styles, accessibility roots, global providers | Auth decisions, active navigation, feature data |
| PublicLayout | Centered/minimal brand framing for landing/auth flows | Sidebar, desktop status, protected overlays |
| ProtectedLayout | Authenticated shell boundary and resilient app frame | Business content, feature-specific side effects |
| SettingsLayout | Settings subnavigation/frame | User settings data/mutation logic |
| Page | Page title, feature shell, page-local loading/error boundary | Global navigation and global overlays |
| GlobalOverlays | Portal mount and shell-level modal coordination | Feature action execution or business confirmation logic |

Next layouts persist during client navigation, so active route matching must live in a client navigation component. Layouts must not depend on changing query parameters or dynamic business data; page/client components own those changing values.

## 4. Protected navigation architecture

### 4.1 Navigation model

The navigation model is a typed, static presentation manifest in the shell layer. It contains only label, icon, destination, match rule, desktop availability, and visual grouping. It contains no permissions, counts, unread state, project records, or feature logic.

| Group | Destinations | Desktop behavior |
|---|---|---|
| Core | Dashboard, Chat | Available in web and desktop |
| Workspace | Knowledge, Projects, Developer | Available in web and desktop |
| Utility | Notifications, Settings | Available in web and desktop |
| Desktop indicator | Connection/model/system status | Rendered only after desktop bridge reports state |

The protected route boundary from Phase 3 decides whether a user is authenticated. Individual product pages later apply their own RLS-backed data access. The shell does not infer access from client state.

### 4.2 Navigation state flow

~~~mermaid
flowchart LR
  URL[Next URL and route segment] --> Match[Client route matcher]
  Match --> Sidebar[Sidebar active item]
  Match --> Header[Header title/breadcrumb]
  Match --> Mobile[Mobile sheet active item]
  UserClick[User navigation click] --> Router[Next navigation]
  Router --> URL
  UIIntent[Open drawer/palette/notification sheet] --> Zustand[Ephemeral shell store]
  Zustand --> Overlay[Rendered shell overlay]
  Close[Escape, route select, backdrop] --> Zustand
~~~

The route matcher is the single source for active navigation. Zustand never duplicates the pathname or selected route.

### 4.3 Route protection sequence

~~~mermaid
flowchart TD
  Request[Request to application route] --> Public{Public route?}
  Public -->|Yes| PublicLayout[Public layout]
  Public -->|No| Middleware[Phase 3 session refresh/protection]
  Middleware --> Authenticated{Verified session?}
  Authenticated -->|No| Redirect[Sign-in with safe internal return path]
  Authenticated -->|Yes| ProtectedLayout[Persistent AppShell]
  ProtectedLayout --> Page[Requested route page]
  Page --> FutureAuthz[Future page/use-case authorization and RLS]
~~~

This phase only mounts the shell after the Phase 3 boundary has accepted the session. It neither fetches profile records nor authorizes feature data.

## 5. AppShell and sidebar design

Phase 4 is the visual source of truth. This section defines the structural behavior required to apply it consistently.

### 5.1 Responsive shell states

| Viewport/mode | Sidebar | Header | Main content |
|---|---|---|---|
| Wide desktop ≥ 1440 | 272px expanded sidebar | Full title, utility controls, breadcrumb/context area | Fluid 12-column workspace |
| Desktop 1024–1439 | User-toggleable 272px or 76px compact rail | Full title, contextual controls | Fluid workspace |
| Tablet 768–1023 | Closed by default; opens as sheet | Menu trigger, route title, utility controls | 8-column workspace |
| Mobile < 768 | Modal drawer only | Menu trigger, concise route title, notifications | 4-column workspace |
| Electron desktop | Same desktop geometry plus optional status strip | Indicates local model/device availability | Shared web content; native capability UI is additive |

The sidebar mode is a presentation preference. CSS chooses default geometry; user-triggered compact/expanded state is held in the shell store. The mobile drawer is not a second navigation tree—it renders the same navigation manifest.

### 5.2 AppShell anatomy

~~~text
AppShell
├─ SkipToContentLink
├─ DesktopStatusStrip (conditional)
├─ AppSidebar
│  ├─ BrandLockup
│  ├─ GlobalCommandTrigger
│  ├─ PrimaryNavigation
│  ├─ ContextualNavigationSlot
│  ├─ UtilityNavigation
│  └─ UserFooterSlot
├─ WorkspaceHeader
│  ├─ MobileMenuTrigger
│  ├─ Breadcrumb/RouteTitle
│  ├─ ContextSlot
│  ├─ CommandTrigger
│  └─ UtilityActions
├─ MainContentFrame
│  └─ Page children
└─ GlobalOverlays
   ├─ MobileNavigationSheet
   ├─ CommandPalette
   ├─ NotificationSheet
   └─ ShellStatusBanner
~~~

The contextual navigation and user footer are intentionally empty slots in Phase 5. Future phases can supply recent conversations, workspace switcher, profile menu, notifications, or device status without restructuring navigation.

### 5.3 Sidebar interactions

| Interaction | Result | Accessibility requirement |
|---|---|---|
| Select primary item | Navigate; active item follows URL | Current page announced with aria-current |
| Toggle compact mode | Switch 272px/76px desktop presentation | Control has an explicit label; icons retain tooltip/name |
| Open mobile menu | Open modal navigation sheet | Focus moves into sheet and returns to trigger on close |
| Press Escape | Close topmost shell overlay | Does not navigate away or discard user work |
| Select mobile destination | Navigate then close sheet | Same navigation semantics as desktop |
| Keyboard command trigger | Open palette | Global shortcut is discoverable and not intercepted inside text input |
| Skip link | Move to main content | First focusable item in protected shell |

## 6. Dashboard shell

The Phase 5 dashboard is an information architecture and visual frame. No metrics, queries, charts, agent state, or task logic is implemented here.

~~~text
DashboardPage
└─ DashboardShell
   ├─ DashboardHeader
   │  ├─ RouteTitle
   │  ├─ WorkspaceContextSlot
   │  └─ TimeWindow/QuickActionSlots
   ├─ DashboardStatusStrip
   │  └─ Four structural status slots
   ├─ DashboardPriorityRegion
   │  └─ Two priority content slots
   ├─ DashboardWidgetGrid
   │  ├─ Wide widget slot
   │  ├─ Standard widget slot
   │  ├─ Standard widget slot
   │  └─ Timeline widget slot
   └─ DashboardAmbientSlot
      └─ Optional static AI Core fallback
~~~

### Dashboard grid behavior

| Area | Desktop | Tablet | Mobile | Phase 5 behavior |
|---|---|---|---|---|
| Header | 12 columns | 8 columns | 4 columns | Static route/header composition |
| Status strip | 12 columns, four cells | 2×2 cells | stacked | Neutral structural placeholders |
| Priority region | 8–12 columns | full width | full width | Empty/ready state only |
| Widget grid | 3/4/6/8/12 spans | 4/8 spans | full width | Defines ordering and responsive spans |
| Ambient slot | optional, non-blocking | hidden if constrained | hidden | Static fallback only |

Dashboard status/priority/widget slots accept only presentational child contracts. Future modules populate them via composition; they do not change the grid or create a new dashboard shell.

## 7. Zustand state-management architecture

### 7.1 Ownership matrix

| State category | Owner | Examples | Explicitly excluded |
|---|---|---|---|
| URL/navigation | Next App Router | Pathname, route params, query params, active route | Sidebar current route |
| Auth/session | Phase 3 server/session adapter | Verified user/session, sign-out lifecycle | JWT/access token/refresh token in Zustand |
| Remote/server state | Future TanStack Query or server components | Conversations, profiles, projects, messages, notifications | Cached database tables in Zustand |
| Shell presentation | Zustand | Sidebar mode, mobile nav open, command palette open, overlay stack | Permissions, selected user identity |
| Page-local ephemeral | React component state | Tooltip open, one input focus state, temporary hover | Global shell controls |
| Persisted preferences | Supabase settings, later synchronized intentionally | Reduced motion, default workspace, model preference | Local storage as source of truth |
| Desktop capability status | Typed desktop bridge + shell presentation adapter | Bridge connected/disconnected visual state | Direct IPC implementation or system telemetry |

### 7.2 Store boundaries

~~~text
StoreProvider (client boundary)
├─ ShellStore
│  ├─ sidebarMode: expanded | compact
│  ├─ mobileNavigationOpen: boolean
│  ├─ desktopStatusVisible: boolean
│  └─ activeShellBanner: none | connectivity | offline | maintenance
├─ OverlayStore
│  ├─ commandPaletteOpen: boolean
│  ├─ notificationSheetOpen: boolean
│  └─ overlayOrder: shell-only stack
└─ PresentationPreferenceAdapter
   ├─ reduced-motion display preference
   └─ initial sidebar mode hydration contract
~~~

A shell action changes only one presentational concern: open/close/toggle/dismiss/reset. Stores have no asynchronous fetching, mutation, authorization, business calculation, or cross-feature workflow actions.

### 7.3 SSR and hydration rules

- Zustand stores are created through a client provider/factory per rendered application instance; they are never read or mutated by React Server Components.
- The initial client store snapshot is deterministic and matches server-rendered shell markup.
- Browser-only persisted preferences hydrate after the initial render or arrive through a server-provided, matching preference snapshot; they must not cause sidebar/theme flashes.
- Do not use a module-level global store for server rendering.
- On sign-out, route change from protected to public, or desktop bridge loss, reset only the relevant presentation state; do not attempt to clear server truth from Zustand.
- The shell must render correctly if all stores are at defaults, JavaScript is delayed, a preference is unavailable, or the desktop bridge is absent.

### 7.4 State transition diagram

~~~mermaid
stateDiagram-v2
  [*] --> Defaults
  Defaults --> Expanded: desktop default
  Defaults --> Compact: saved UI preference
  Expanded --> Compact: toggle
  Compact --> Expanded: toggle
  Expanded --> MobileSheet: viewport changes and user opens menu
  Compact --> MobileSheet: viewport changes and user opens menu
  MobileSheet --> Expanded: route selected or dismissed on wide viewport
  MobileSheet --> Compact: route selected or dismissed on compact preference
  Expanded --> CommandPalette: command trigger
  Compact --> CommandPalette: command trigger
  CommandPalette --> Expanded: escape/select/dismiss
  CommandPalette --> Compact: escape/select/dismiss
~~~

## 8. Component architecture

~~~text
ProtectedLayout
└─ AppShellProvider
   └─ AppShell
      ├─ AccessibilityLayer
      │  ├─ SkipToContentLink
      │  └─ LiveAnnouncementRegion
      ├─ ChromeLayer
      │  ├─ DesktopStatusStrip
      │  ├─ AppSidebar
      │  └─ WorkspaceHeader
      ├─ ContentLayer
      │  └─ MainContentFrame
      │     └─ Route page / layout children
      └─ OverlayLayer
         ├─ CommandPalette
         ├─ MobileNavigationSheet
         ├─ NotificationSheet
         └─ ShellStatusBanner
~~~

### Shell component contracts

| Component | Input contract | Output/behavior | No business responsibility |
|---|---|---|---|
| AppShell | route children, static nav manifest, presentation state | Responsive chrome and overlay mount | Fetching a user, projects, messages, or system data |
| AppSidebar | nav items, route match, sidebar mode | Semantically labelled navigation | Permission calculation/counts |
| WorkspaceHeader | route presentation metadata, slots | Route context and utility placement | Workspace resolution/query |
| MainContentFrame | children | Correct landmark, scroll container, width | Page content logic |
| CommandPalette | static command/navigation presentation | Opens/closes/search UI shell | Command execution |
| MobileNavigationSheet | same nav manifest | Accessible responsive navigation | Separate navigation data |
| DashboardShell | slots and responsive grid | Dashboard spatial hierarchy | Dashboard metrics or interactions |
| ShellStatusBanner | display status contract | Clear visual/status placement | Monitoring, retry, network logic |
| DesktopStatusStrip | typed visual status contract | Desktop-only enhancement | Native checks or actions |

## 9. Loading, error, and empty-state strategy

| Route level | Loading behavior | Error behavior | Empty behavior |
|---|---|---|---|
| Root/protected shell | Keep shell visible; no full-screen spinner | Global-error only for unrecoverable app fault | Not applicable |
| Dashboard overview | Dashboard-specific skeleton grid | Dashboard error panel, retains chrome | Phase 4 EmptyState within slot |
| Chat | Conversation-frame placeholder | Chat-local recovery area | New conversation invitation |
| Projects/knowledge | List/detail frame skeleton | Route-local error panel | Task-specific zero state later |
| Settings | Form-frame skeleton | Settings-local error panel | Not applicable |

Use loading and error files at the smallest route boundary that owns the visual region. Do not put data-dependent work in a persistent layout merely to make a loading state appear; App Router layouts can remain cached across navigation.

## 10. Shell quality gates

| Gate | Acceptance condition |
|---|---|
| Route organization | Every declared URL has one route owner; route groups do not create collisions |
| Persistent chrome | Sidebar/header do not remount during protected sibling navigation |
| Route truth | Active navigation derives from current URL and works on deep links/back/forward |
| Responsive navigation | Desktop rail, tablet sheet, and mobile drawer share one manifest and keyboard semantics |
| Zustand discipline | No tokens, session data, remote records, URL state, or business actions stored in Zustand |
| SSR safety | Per-instance client store; stable initial snapshot; no hydration mismatch from preferences |
| Accessibility | Skip link, landmarks, focus-visible, drawer focus trap, Escape close, screen-reader labels |
| Design-system compliance | Components consume Phase 4 semantic tokens and approved sidebar/dashboard patterns |
| Desktop enhancement | Web shell remains complete when desktop bridge/capability status is absent |
| Scope control | No data/query/API/agent/business behavior added in this phase |

## 11. Phase 5 handoff

The next implementation task may create the static app shell and its presentational components exactly from this structure. It must keep feature content behind route/page slots until the corresponding product modules are approved.

Before introducing data, decide the page-level server-data contract and TanStack Query query-key ownership in a separate phase. Do not expand Zustand beyond the UI-state boundary defined here.


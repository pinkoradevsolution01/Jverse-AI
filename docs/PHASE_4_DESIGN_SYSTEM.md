# Phase 4 — JVerse AI Design System

**Status:** Source-of-truth visual and interaction specification  
**Governing sources:** Phase 1 Reference Architecture, Phase 2 Backend, Phase 3 Authentication Module, ADR-0009 JARVIS Local Brain
**Implementation platforms:** Next.js, Tailwind CSS, shadcn/ui, Framer Motion, React Three Fiber, Electron  
**Default theme:** JVerse Night

## 1. Design intent

JVerse should feel like a calm, precise intelligence operating inside a premium professional workspace. It takes its visual energy from JARVIS and cyberpunk instrumentation, but it must never look like a game HUD, a movie prop, or a neon overload.

The product personality is:

| Attribute | Design expression |
|---|---|
| Futuristic | Luminous blue signal states, depth, restrained holographic layers, live data behavior |
| JARVIS-inspired | Orbital intelligence motif, diagnostic precision, voice/reactive state language |
| Cyberpunk | Dark atmospheric base, violet energy accents, narrow luminous borders |
| Professional SaaS | Clear hierarchy, dense-but-readable workspaces, robust forms/tables, predictable states |
| Trustworthy AI | Explicit action state, citations, approval surfaces, visible provenance, no deceptive animation |

**Core rule:** content and action always outrank decoration. The glow should communicate a state, focus, or affordance; it is not wallpaper.

## 2. Design-system architecture

~~~text
packages/ui/
├─ tokens/                    # Semantic color, type, spacing, shape, shadow, motion contracts
├─ primitives/                # shadcn/ui adaptations: button, input, dialog, sheet, tooltip
├─ components/                # JVerse composites: panel, status, command, message, approval
├─ charts/                    # Dashboard visualization tokens and wrappers
├─ scenes/                    # R3F AI Core and non-blocking visual effects
├─ patterns/                  # Sidebar, chat workspace, dashboard grid, settings layouts
└─ documentation/             # Component states, accessibility, visual regression references

apps/web/
├─ styles/                    # Global token import and application-level theme selector
└─ features/                  # Feature composition only; no feature-local foundational tokens

apps/desktop/
└─ renderer/                  # Consumes the same UI contracts; native chrome is an adapter
~~~

### Token ownership

| Level | Purpose | Example |
|---|---|---|
| Reference token | Raw visual value; never used directly by product components | cyan 500, violet 500, space 16 |
| Semantic token | Meaningful product role; used by components | primary, surface-raised, status-success |
| Component token | Local part behavior; implemented by a component only | chat-assistant-surface, sidebar-active-border |
| Feature composition | Arrangement of approved components | ChatWorkspace, ProjectDashboard |

Tailwind maps reference tokens into utilities and semantic CSS variables into shadcn/ui’s background, foreground, primary, border, ring, sidebar, and chart contracts. Product components consume semantic tokens, not hard-coded palette values. This preserves a single future high-contrast theme without component rewrites.

## 3. Color system

### 3.1 Brand anchors

These Phase 1 colors are locked.

| Name | Value | Role |
|---|---:|---|
| Void | #050816 | Application background |
| Arc Cyan | #00E5FF | Primary action, focus, active signal |
| Quantum Violet | #7C3AED | Secondary action, generative/thinking signal |
| Pulse Green | #00FF8F | Success, healthy/ready state |
| Solar Amber | #FFB800 | Warning, attention/review state |
| Signal Rose | #FF4D6D | Error, destructive/blocked state |
| White | #FFFFFF | Primary text on dark surfaces |
| Zinc Mist | #A1A1AA | Secondary text |
| Glass Surface | rgba(255,255,255,0.05) | Elevated translucent surface |
| Glass Border | rgba(255,255,255,0.10) | Default hairline border |

### 3.2 Reference palette

| Family | 950 | 900 | 800 | 700 | 600 | 500 | 400 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Void | #050816 | #081024 | #0D1730 | #14203D | #1D2A4A | #28385A | #405171 |
| Cyan | #003E48 | #005868 | #007A91 | #009FBC | #00BEDB | #00E5FF | #5AEEFF |
| Violet | #25104B | #35166B | #4D2398 | #6330C0 | #7039DE | #7C3AED | #9B6BFF |
| Green | #06452C | #08613D | #088052 | #00A86B | #00C97E | #00FF8F | #65FFB7 |
| Amber | #5C3B00 | #7A5000 | #9E6800 | #C78500 | #E8A000 | #FFB800 | #FFD166 |
| Rose | #65172B | #87203A | #AE284A | #D6385A | #ED4165 | #FF4D6D | #FF8AA0 |
| Neutral | #09090B | #18181B | #27272A | #3F3F46 | #52525B | #71717A | #A1A1AA |

### 3.3 Semantic color roles

| Token role | JVerse Night value | Usage |
|---|---:|---|
| background | Void 950 | App canvas and deepest backdrop |
| background-subtle | Void 900 | Page gradient stop, low-emphasis regions |
| surface | rgba(13,23,48,0.72) | Standard cards, sidebar body |
| surface-raised | rgba(20,32,61,0.78) | Dialogs, command palette, active popovers |
| surface-overlay | rgba(5,8,22,0.92) | Modal backdrop and high-focus layers |
| foreground | White | Heading/body primary text |
| foreground-muted | Zinc Mist | Supporting text and secondary icons |
| foreground-subtle | #71717A | Metadata, disabled labels |
| border | Glass Border | Default structural separation |
| border-strong | rgba(0,229,255,0.30) | Active/focused strategic boundary |
| primary | Arc Cyan | Primary controls, focus ring, selected navigation |
| primary-foreground | Void 950 | Text/icons over solid cyan |
| secondary | Quantum Violet | Alternate action, AI-generative context |
| success | Pulse Green | Completion and healthy state |
| warning | Solar Amber | Review/attention state |
| danger | Signal Rose | Error/destructive state |
| info | #5AEEFF | Informational status and system messages |
| ring | Arc Cyan at 75% | Keyboard focus indicator |
| selection | Cyan 500 at 20% | Text/list selection |
| scrim | rgba(2,4,13,0.70) | Layering behind sheets/dialogs |

### 3.4 Glow and gradient policy

| Effect | Allowed use | Specification |
|---|---|---|
| Cyan focus glow | Keyboard focus, active primary control, speaking/listening orb | One restrained outer glow; never more than one per row |
| Violet energy glow | Thinking/generative AI state, selected AI panel | Reserved for intelligence/progress state |
| Green pulse | Completed/safe local action or healthy status | One short acknowledgement, not a permanent blinking state |
| Gradient surface | Hero/dashboard ambient background | Void to blue-violet at less than 12% perceived opacity |
| Gradient text | Marketing/hero only | Never body, data table, form label, or chat response |
| Neon border | Selected/high-risk approval boundary | Use with a status label; no decorative perimeter grids |

Use cyan and violet together only on AI-state visuals, never ordinary buttons. A screen must have one dominant signal color at any point. Solid semantic color is preferred for action controls; glass plus glow is reserved for status, visual depth, and the AI Core.

### 3.5 Contrast and status rules

- Primary content meets WCAG AA contrast at its deployed size; critical controls and status text target AAA when feasible.
- Color never carries meaning alone. Every semantic state includes an icon, clear text, and where relevant a pattern/position.
- Disabled controls use reduced contrast plus disabled semantics, not opacity alone.
- Destructive actions use Signal Rose only after intent is explicit; a danger color never identifies a neutral notification.
- Charts use color plus direct labels, shape/line style, tooltips, and a non-color summary.

## 4. Typography

### 4.1 Font roles

| Role | Family | Use |
|---|---|---|
| Interface/display | Geist Sans, Inter fallback, system sans-serif | Navigation, UI, dashboards, headings |
| Reading | Geist Sans, Inter fallback, system sans-serif | Chat prose, documents, long-form settings |
| Code/data | JetBrains Mono, ui-monospace fallback | Code blocks, terminal-like outputs, IDs, timestamps |
| AI visual label | Interface/display with uppercase tracking | Orb/telemetry micro-labels only |

Avoid novelty sci-fi fonts. The futuristic quality comes from spacing, signal language, and material—not hard-to-read typography.

### 4.2 Type scale

| Token | Size / line-height | Weight | Use |
|---|---|---:|---|
| display-xl | 48 / 56 | 650 | Landing or empty-state hero only |
| display-lg | 36 / 44 | 650 | Workspace page title at large desktop |
| h1 | 30 / 38 | 650 | Primary page title |
| h2 | 24 / 32 | 620 | Section title |
| h3 | 20 / 28 | 600 | Card/region title |
| h4 | 16 / 24 | 600 | Compact region title |
| body-lg | 16 / 26 | 400 | Reading-rich chat/document body |
| body | 14 / 22 | 400 | Default application text |
| body-sm | 13 / 20 | 400 | Dense supporting content |
| label | 12 / 16 | 560 | Form, navigation, compact label |
| micro | 11 / 14 | 560 | Timestamp, telemetry, status chip |
| code | 13 / 20 | 400 | Code and structured output |

Use sentence case for product labels and actions. Uppercase is limited to micro telemetry labels; apply 0.08em tracking and never use it for a paragraph or a critical action.

### 4.3 Text behavior

- Keep chat prose at a comfortable 65–78 character measure.
- Use tabular numerals for dashboard metrics, timestamps, and numeric comparisons.
- Minimum interactive text is 12px; default form/control text is 14px.
- Truncate only single-line navigational labels; preserve full title with tooltip/accessible name.
- Markdown headings in chat remain visually subordinate to application headings.

## 5. Spacing, layout, shape, and elevation

### 5.1 Spacing scale

The system uses a 4px base unit.

| Token | Value | Common use |
|---|---:|---|
| 0 | 0 | Flush alignment |
| 1 | 4px | Icon-to-label micro gap |
| 2 | 8px | Compact control gap |
| 3 | 12px | Form field/metadata gap |
| 4 | 16px | Default card/control padding |
| 5 | 20px | Section-in-card spacing |
| 6 | 24px | Standard card padding |
| 8 | 32px | Workspace section separation |
| 10 | 40px | Page-region separation |
| 12 | 48px | Major page separation |
| 16 | 64px | Hero/large empty state |
| 20 | 80px | Marketing-only expansion |

No arbitrary one-off spacing in feature code. A visual exception needs a component token and documentation.

### 5.2 Layout grid

| Context | Grid and gutters | Rules |
|---|---|---|
| Desktop ≥ 1440 | 12 columns, 32px gutters, 32px page padding | Dashboard default |
| Laptop 1024–1439 | 12 columns, 24px gutters, 24px page padding | Sidebar may compact |
| Tablet 768–1023 | 8 columns, 20px gutters, 20px padding | Sidebar becomes overlay/rail |
| Mobile < 768 | 4 columns, 16px gutters, 16px padding | One task context at a time |

The standard authenticated shell uses a fixed navigation rail/sidebar and a fluid primary workspace. Content max-width is contextual: chat reading content maxes at 860px; settings at 760px; dashboard uses available grid width.

### 5.3 Shape and material

| Token | Value | Use |
|---|---:|---|
| radius-sm | 8px | Inputs, badges, compact controls |
| radius-md | 12px | Buttons, menu rows, message attachments |
| radius-lg | 16px | Cards, panels, command palette |
| radius-xl | 24px | Feature hero/AI Core container only |
| radius-full | 999px | Avatars, status dots, pill tags |
| border-default | 1px | Structural surfaces |
| border-focus | 2px | Keyboard focus only |
| blur-glass | 20px | Floating shell/dialog glass; use sparingly |
| shadow-raised | 0 16px 48px rgba(0,0,0,0.28) | Menus/dialogs |
| shadow-glow-cyan | 0 0 24px rgba(0,229,255,0.22) | Focused/active AI signal |
| shadow-glow-violet | 0 0 28px rgba(124,58,237,0.20) | Thinking signal |

Glass surfaces must remain readable over the underlying content. Always pair blur with a dark tint, border, and non-transparent text/background fallback. Never layer more than two glass planes.

## 6. Component system

shadcn/ui is the accessible primitive base. JVerse composes and styles it; it does not fork interaction semantics for visual novelty.

### 6.1 Primitive inventory

| Component | JVerse variants/states | Rules |
|---|---|---|
| Button | primary, secondary, ghost, outline, danger, icon, loading | One primary CTA per local region; loading preserves width and announces state |
| Input/textarea | default, filled, invalid, disabled, with leading/trailing utility | Labels always visible; error message sits below field |
| Select/combobox | standard, searchable, command-driven | Keyboard navigation and visible current value required |
| Checkbox/switch | default, checked, indeterminate, disabled | Use switch only for immediate settings; confirm risky changes |
| Dialog/sheet/alert dialog | standard, approval, destructive, fullscreen mobile | Trap focus, restore focus, keep one primary action |
| Dropdown/context menu | compact, destructive section, checkable | Do not hide primary workflow solely in a menu |
| Tabs | underline, segmented, compact rail | Tabs switch peer content only, never route unrelated tasks |
| Tooltip/popover | informational, rich/citation, form help | Tooltip supplements; it never supplies required control meaning |
| Toast | info, success, warning, error, action result | Max three visible; critical errors persist in activity/notification center |
| Table/data grid | density comfortable/compact, loading/empty/error | Sticky header only in dense desktop contexts; mobile becomes cards/detail |
| Command palette | global, workspace, contextual | Keyboard-first, searchable, respects current permissions |
| Avatar | user, agent, device | Always has text fallback/accessible name |
| Badge/status chip | neutral, info, success, warning, danger, AI | Status wording is explicit; no purely decorative pills |

### 6.2 JVerse composite components

| Component | Composition | Contract |
|---|---|---|
| GlassPanel | Card + semantic material/elevation | Primary reusable surface; supports calm, active, critical emphasis only |
| StatusIndicator | Icon + label + semantic color | Represents health, connectivity, agent/voice/system state |
| AgentStateChip | StatusIndicator + optional elapsed time | Uses idle/listening/thinking/processing/speaking/error vocabulary |
| CommandTrigger | Button + command palette | Global trigger is discoverable and keyboard-addressable |
| ApprovalSheet | Alert dialog + action summary + risk tier + result | Required for Phase 1 agent consent; never auto-dismisses while awaiting choice |
| CitationCard | Popover/sheet + source metadata | Shows provenance and opens an authorized source |
| CodeBlock | Reading surface + language label + copy action | Horizontal scroll, wrap control, safe copy feedback |
| MetricCard | GlassPanel + trend + chart slot | One question per card; does not overload metrics |
| EmptyState | Illustration/AI-core static asset + title + next action | Must name why it is empty and how to proceed |
| ConnectionBanner | Status + retry/details | Reserved for model, sync, auth, or network state |
| VoiceControl | Push-to-talk control + state label + privacy cue | Electron/Whisper/Piper state is unmistakable and user-controllable; browser speech is development fallback only |

### 6.3 States every component must specify

Every interactive component documents: rest, hover, focus-visible, pressed, selected, disabled, loading, invalid/error, empty, and unavailable/offline as applicable. AI/action components additionally document: proposed, awaiting approval, executing, completed, failed, cancelled, and expired.

## 7. Sidebar and application shell

### 7.1 Sidebar anatomy

~~~text
Sidebar
├─ BrandLockup
│  ├─ JVerse Mark
│  ├─ Product Name
│  └─ Desktop/Cloud Status
├─ GlobalCommandTrigger
├─ PrimaryNavigation
│  ├─ Dashboard
│  ├─ Chat
│  ├─ Knowledge
│  ├─ Projects
│  └─ Developer
├─ ContextualNavigation
│  ├─ Recent Conversations or Project Switcher
│  └─ Pinned Items
├─ UtilityNavigation
│  ├─ Notifications
│  ├─ Settings and Privacy
│  └─ Help/Feedback
└─ UserFooter
   ├─ ProfileMenu
   └─ Connection/Model Status
~~~

### 7.2 Sidebar behavior

| Mode | Width | Behavior |
|---|---:|---|
| Expanded desktop | 272px | Labels, contextual list, model/connectivity status visible |
| Compact desktop | 76px | Icon rail; tooltip and accessible label reveal navigation meaning |
| Tablet | overlay sheet | Triggered by top bar; closes after route selection |
| Mobile | modal drawer | Full task navigation; no permanently compressed content |

The selected item uses a low-opacity cyan surface, 1px cyan-tinted border, and 3px left signal bar. It does not rely on glow alone. Hover uses surface raise; focus-visible uses the global cyan ring. The sidebar itself is a quiet dark surface, not a neon panel.

## 8. Chat workspace design

### 8.1 Layout

~~~text
ChatWorkspace
├─ ConversationRail
│  ├─ NewConversation
│  ├─ Search
│  └─ ConversationList
├─ ChatHeader
│  ├─ ConversationTitle
│  ├─ Model/Mode indicator
│  └─ Share/Export/More actions
├─ MessageTimeline
│  ├─ UserMessage
│  ├─ AssistantMessage
│  ├─ ToolProgress
│  ├─ ApprovalSheet trigger
│  └─ Citation/Artifact cards
├─ ComposerDock
│  ├─ Attachment/Menu controls
│  ├─ Multiline composer
│  ├─ Voice control
│  └─ Send/Stop action
└─ OptionalAgentInspector
   ├─ Plan/progress
   ├─ Context/citations
   └─ Action audit
~~~

### 8.2 Message language

| Element | Visual treatment |
|---|---|
| User message | Right-aligned or clearly user-attributed; cyan-tinted 8% surface; no oversized bubble |
| Assistant message | Full reading-width content; near-transparent surface to reduce card fatigue; JVerse mark and timestamp |
| System/status message | Compact inline status row, never impersonates assistant prose |
| Streaming answer | Stable text insertion; reserve output region; no layout jump or typewriter effect that delays readable text |
| Tool progress | Collapsible timeline with plain-language status and elapsed time |
| Approval request | Persistent, high-clarity card/sheet with target, effect, risk tier, approve/deny |
| Citation | Numbered inline marker plus hover/click preview card; source title/date/section available |
| Code block | Void 900 surface, mono type, visible language/copy action, horizontal-scroll fallback |
| Error | Rose-accented but readable error card with retry or next step; never silently disappear |

### 8.3 Composer

The composer is always visible while the user is in a conversation, docks above safe areas, supports multi-line input, and has a comfortable 48px minimum control height. The send control is primary cyan only when there is sendable content; stop-generation replaces it during a stream. Voice controls show whether input is listening, processing, or off, and include a privacy disclosure on first use.

Do not simulate thought with endless dots. Use the real agent state from Phase 1: contextualizing, planning, awaiting approval, executing, synthesizing, completed, failed, cancelled, or expired.

## 9. Dashboard design

### 9.1 Dashboard hierarchy

~~~text
Dashboard
├─ Header: greeting, workspace selector, time window, quick command
├─ AI Status Strip: model availability, memory/RAG health, sync/device condition
├─ Priority Region
│  ├─ Continue conversation
│  ├─ Awaiting approval
│  └─ Today’s project actions
├─ Insight Grid
│  ├─ Recent chats
│  ├─ Project progress
│  ├─ Knowledge base activity
│  ├─ System analytics (desktop only)
│  └─ Activity timeline
└─ Optional AI Core Ambient Region
~~~

### 9.2 Widget rules

| Widget type | Grid span desktop | Content rules |
|---|---:|---|
| Status strip | 12 | Max four concise conditions; no decorative chart |
| Priority/approval | 8–12 | Always appears above passive analytics |
| Metric card | 3–4 | One primary metric, one comparison, one optional compact trend |
| Activity/timeline | 4–6 | Chronological, human-readable, filterable |
| Project overview | 6–8 | Status, next task, progress—not a duplicate project list |
| System analytics | 4–6 | Desktop-only and explicitly labels sample freshness |
| Knowledge health | 4–6 | Shows indexed/processing/failed counts with recovery link |

Dashboards must degrade cleanly: web mode omits desktop-only telemetry rather than showing fake zeroes; offline mode labels cached timestamps. Empty cards are replaced by a clear invitation, not a chart skeleton that persists indefinitely.

## 10. Motion guidelines

Framer Motion supplies orchestration and state continuity. CSS handles simple non-blocking hover/focus transitions where no sequencing is needed.

### 10.1 Motion vocabulary

| Token | Duration | Easing | Use |
|---|---:|---|---|
| instant | 100ms | linear | Pressed feedback, opacity cue |
| fast | 160ms | standard decelerate | Hover/focus, menu row emphasis |
| standard | 220ms | cubic-bezier(.2,.8,.2,1) | Panels, message arrival, toast |
| deliberate | 320ms | cubic-bezier(.16,1,.3,1) | Sheets, sidebar mode, page-region transition |
| ambient | 2400–6000ms | linear/sine-like | AI Core breathing and subtle particle drift only |

### 10.2 Motion rules

- Motion explains a state change, spatial relationship, completion, or attention need. If it does none, omit it.
- Entering content fades and translates at most 8px. Avoid large scale/zoom transitions for product UI.
- Use layout animation only for local reflow where origin/destination are clear; never animate a whole data table on refresh.
- New chat text appears immediately. Streaming uses stable insertion and optional subtle cursor, not character-by-character theatrical typing.
- Keep concurrent motion to two local elements per region maximum. Ambient 3D is excluded only when non-interactive and performance-budgeted.
- Loading uses skeleton geometry for expected content and a labeled progress/status surface for long-running AI work.
- Error states do not shake. Use clear status, focus management, and an actionable next step.
- Motion sequencing cannot postpone keyboard input, screen-reader announcement, or action completion.

### 10.3 Accessibility and preferences

The global Motion configuration respects the operating system reduced-motion setting and the user’s Phase 2 reduced-motion preference. In reduced motion:

- Replace movement/scale/layout transitions with opacity or instant state changes.
- Disable parallax, looping particle movement, automatic camera motion, and typewriter effects.
- Keep meaningful progress/status updates visible and announced.
- Pause decorative animation when the application is backgrounded or the window is unfocused.

## 11. 3D AI Core guidelines

React Three Fiber is an enhancement layer, never an information or control dependency.

### 11.1 AI Core composition

| Element | Purpose | Limits |
|---|---|---|
| Holographic orb | Primary AI identity and current voice/agent state | One orb per visible viewport |
| Orbital rings | Thought/listening energy | Maximum three rings; state-driven |
| Particle field | Atmospheric depth | Low density; no text-like visual noise |
| Waveform | Voice activity feedback | Uses real audio state only |
| Reactive light | State tint and focus depth | Subtle and bounded; no white flash |
| Energy pulse | Completion/attention acknowledgement | Event-driven, short, non-looping |

### 11.2 State mapping

| State | Color/material | Motion | Textual companion |
|---|---|---|---|
| Idle | Cyan 30%, violet trace | Slow breathing | JVerse ready |
| Listening | Cyan dominant | Inward pulse plus real waveform | Listening |
| Thinking | Cyan-violet blend | Ring rotation, no rapid pulse | Thinking |
| Processing | Violet dominant | Measured orbital progress | Processing request |
| Speaking | Cyan dominant | Real waveform/outward pulse | Speaking |
| Error/offline | Rose/neutral, reduced glow | Motion stops | Attention needed / Offline |

The visual state is driven only by the agent/voice state machine defined in Phase 1 and ADR-0009. Whisper/Piper/Electron events are authoritative in desktop production; it never pretends to be listening, thinking, or speaking.

### 11.3 Performance and fallback

- Create one shared Canvas per route/scene, lazily load it after primary content is interactive, and pause/dispose it when hidden.
- Prefer instancing, shaders/material reuse, compressed assets, device pixel ratio caps, and a bounded particle count.
- Set performance budgets per target hardware before adding post-processing. Low-power mode reduces particles, disables bloom, and lowers pixel ratio.
- Provide a static CSS/SVG-like fallback using semantic status text for web, reduced-motion, unsupported GPU, and battery-sensitive contexts.
- Canvas must not trap keyboard focus, obscure text selection, consume critical pointer targets, or cover approval dialogs.
- Do not use 3D on forms, tables, long chat reading areas, or every dashboard card.

## 12. Accessibility, quality, and adoption gates

### Required quality gates

| Area | Gate |
|---|---|
| Tokens | No raw palette values in product feature code; semantic token review passes |
| Components | Keyboard, focus-visible, disabled, loading, error, empty, and screen-reader states documented |
| Contrast | Automated contrast checks plus visual review for translucent surfaces |
| Responsive | Screenshot/reference review at mobile, tablet, laptop, and wide desktop widths |
| Motion | Reduced-motion path is tested; no critical meaning depends on animation |
| AI | Approval/progress/citation states are distinguishable without color or 3D |
| Performance | Dashboard/chat remain useful without Canvas; 3D meets device-specific budget |
| Theme | All shadcn/ui primitives map to JVerse semantic variables before feature adoption |

### Implementation sequence

1. Establish reference and semantic tokens in the shared UI package.
2. Map shadcn/ui variables and primitives to those semantics.
3. Build foundational JVerse composites: GlassPanel, StatusIndicator, CommandTrigger, ApprovalSheet, CitationCard, CodeBlock.
4. Apply the shell/sidebar and then the chat workspace pattern.
5. Apply dashboard widget/grid patterns.
6. Add Motion defaults and reduced-motion test fixtures.
7. Add the AI Core only after a static stateful fallback and performance budget exist.
8. Capture component states in a visual-regression catalog before feature teams consume them.

No feature-specific visual work may redefine global colors, spacing, typography, focus, or status semantics.


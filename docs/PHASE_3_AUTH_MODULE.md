# Phase 3 — Authentication Module Architecture

**Status:** Approved implementation specification  
**Governing sources:** Phase 1 Reference Architecture, Phase 2 Supabase Backend  
**Scope:** Google sign-in, email/password authentication, protected routes, session/JWT handling, and user profiles.  
**Non-goal:** This phase does not add a new identity provider, alter RLS, create an application-issued JWT, or give Electron renderer access to service-role credentials.

## 1. Decisions inherited from Phases 1 and 2

| Existing decision | Phase 3 application |
|---|---|
| Supabase Auth is the identity/session authority | Supabase issues and refreshes user JWTs. JVerse never mints a parallel application JWT. |
| Supabase Postgres is the cloud system of record | auth.users is the identity root; public.profiles is the product-profile projection. |
| RLS is the authorization boundary | JWT subject maps to auth.uid(), and policies remain the final data authorization layer. |
| Next.js is the web experience and narrow BFF | Next owns browser-facing auth pages, callback handling, protected-route gating, and server-rendered session reads. |
| Express is the trusted control plane | Express verifies a presented Supabase JWT before running a protected API use case. |
| Electron main is the desktop authority | Main owns desktop-session persistence and browser handoff; preload exposes status/commands, never session secrets. |
| Personal data remains owner-private | Profile reads/updates use the existing profile RLS policy; metadata is not an authorization source. |
| Device registration/capability grants exist | A desktop device is registered only after a verified user session is established. |

## 2. Authentication model

### Roles and authorities

| Actor | Authority | May not do |
|---|---|---|
| Supabase Auth | Credential validation, Google broker flow, session/JWT issuance, refresh-token rotation, password reset | Product authorization or native actions |
| Next.js auth boundary | Cookie session lifecycle, callback exchange, safe redirect validation, route protection | Issue its own user JWT or use service-role keys |
| Browser client | Submit credentials/start provider redirect, render auth/session state | Treat a decoded token as trusted authorization |
| Express API | Cryptographically verify bearer JWT and derive principal | Trust a client-supplied user ID or unverified token |
| Supabase RLS | Enforce row access using the verified database principal | Depend on mutable user metadata for authorization |
| Electron main | Secure local session broker and device handoff | Expose refresh tokens to renderer |
| Electron preload/renderer | Request sign-in/out and display session state | Access credentials, refresh tokens, or generic IPC |

### Canonical identity mapping

~~~text
Supabase auth.users.id
        = JWT sub
        = public.profiles.id
        = public workspace_members.user_id
        = owner/user/creator references throughout Phase 2
~~~

The Phase 2 auth trigger creates a profile, personal workspace, owner membership, and settings record when a new Auth user is created. It is the only profile-provisioning mechanism. No client may create a duplicate profile row.

## 3. Folder structure

~~~text
apps/
├─ web/
│  ├─ app/
│  │  ├─ (public)/
│  │  │  ├─ auth/
│  │  │  │  ├─ sign-in/
│  │  │  │  ├─ sign-up/
│  │  │  │  ├─ forgot-password/
│  │  │  │  ├─ reset-password/
│  │  │  │  ├─ verify-email/
│  │  │  │  └─ auth-error/
│  │  │  ├─ page/
│  │  │  ├─ auth/
│  │  │  │  └─ callback/
│  │  │  └─ desktop/
│  │  │     └─ handoff/
│  │  ├─ (protected)/
│  │  │  ├─ layout/
│  │  │  ├─ dashboard/
│  │  │  ├─ chat/
│  │  │  ├─ projects/
│  │  │  └─ settings/profile/
│  │  ├─ api/
│  │  │  └─ auth/
│  │  │     ├─ sign-out/
│  │  │     ├─ desktop-handoff/
│  │  │     └─ session/
│  │  ├─ middleware.ts
│  │  ├─ features/auth/
│  │  │  ├─ components/
│  │  │  ├─ hooks/
│  │  │  ├─ schemas/
│  │  │  └─ auth-state/
│  │  └─ lib/auth/
│  │     ├─ browser-client/
│  │     ├─ server-client/
│  │     ├─ middleware-session/
│  │     ├─ redirect-policy/
│  │     └─ session-contract/
│  ├─ desktop/
│  │  ├─ main/auth/
│  │  │  ├─ desktop-session-broker/
│  │  │  ├─ system-browser-handoff/
│  │  │  ├─ secure-session-store/
│  │  │  └─ device-registration/
│  │  ├─ preload/auth/
│  │  └─ renderer/features/auth/
│  └─ api/
│     ├─ middleware/
│     │  └─ authenticate-principal/
│     └─ modules/identity/
│        ├─ identity-routes/
│        ├─ identity-service/
│        └─ profile-repository/
├─ packages/
│  ├─ contracts/auth/
│  │  ├─ auth-events/
│  │  ├─ identity-dtos/
│  │  └─ desktop-handoff-contract/
│  ├─ domain/identity/
│  │  ├─ profile/
│  │  ├─ session/
│  │  └─ device-identity/
│  ├─ security/auth/
│  │  ├─ jwt-verification/
│  │  ├─ redirect-allowlist/
│  │  └─ authz-principal/
│  └─ test-kit/auth/
│     ├─ fixtures/
│     ├─ rls-cases/
│     └─ flow-cases/
└─ supabase/
   ├─ migrations/             # Phase 2 schema remains authoritative
   └─ functions/
      └─ account-erasure-dispatch/
~~~

Structural rules:

- Browser and renderer code depends only on the browser-safe auth contract.
- Server, Express, and Electron main adapters may implement session/token operations.
- The user password is transmitted only to Supabase Auth over TLS; it is never sent to Express, logged, persisted, or placed in application state.
- Supabase SSR package usage is isolated in the web auth adapter because its API can evolve independently of the domain contract.

## 4. Flow diagrams

### 4.1 Email/password sign-up and profile provisioning

~~~mermaid
sequenceDiagram
  participant U as User
  participant UI as Next.js auth UI
  participant SA as Supabase Auth
  participant DB as Phase 2 Postgres
  participant Mail as Verification email
  U->>UI: Submit email and password
  UI->>SA: Sign-up request
  SA->>DB: Insert auth.users identity
  DB->>DB: Auth trigger creates profile, personal workspace, owner membership, settings
  SA->>Mail: Send verification link when confirmation is enabled
  Mail-->>U: Verification link
  U->>UI: Open verified callback
  UI->>SA: Exchange code using PKCE
  SA-->>UI: Cookie session and JWT
  UI->>DB: Read own profile through RLS
  UI-->>U: Protected onboarding/dashboard
~~~

### 4.2 Email/password sign-in and session refresh

~~~mermaid
sequenceDiagram
  participant U as User
  participant UI as Browser
  participant SA as Supabase Auth
  participant MW as Next middleware
  participant Page as Protected route
  U->>UI: Submit email and password
  UI->>SA: Authenticate
  SA-->>UI: Access token plus rotating refresh session
  UI->>MW: Navigate to protected route
  MW->>SA: Refresh/validate cookie session when needed
  MW-->>UI: Updated secure cookies or redirect to sign-in
  UI->>Page: Request protected page
  Page->>SA: Resolve verified user session
  Page-->>UI: Authorized response
~~~

### 4.3 Google login through Supabase with PKCE

~~~mermaid
sequenceDiagram
  participant U as User
  participant App as Next.js
  participant SA as Supabase Auth
  participant G as Google
  U->>App: Select Continue with Google
  App->>SA: Start OAuth with PKCE verifier cookie and approved redirect URL
  SA->>G: Redirect to Google authorization
  U->>G: Authenticate and consent
  G->>SA: Authorization response
  SA->>App: Redirect with authorization code
  App->>SA: Callback exchanges code using stored PKCE verifier
  SA-->>App: Session cookies and JWT
  App-->>U: Validated internal destination
~~~

Google's authorized redirect URI is the Supabase Auth callback URL. JVerse callback URLs are configured in Supabase Auth's redirect allowlist; they are not a substitute for Google-provider configuration.

### 4.4 Protected route and Express API authorization

~~~mermaid
flowchart LR
  Request[Route/API request] --> Route{Public route?}
  Route -->|Yes| Public[Render public content]
  Route -->|No| Session[Read and refresh cookie session]
  Session --> Valid{Verified user?}
  Valid -->|No| Login[Redirect to sign-in with internal next path]
  Valid -->|Yes| SSR[Render protected page]
  SSR --> API[Express request with bearer JWT]
  API --> Verify[Verify signature, expiry, issuer, audience]
  Verify --> Principal[Construct principal from JWT subject]
  Principal --> UseCase[Authorized use case]
  UseCase --> RLS[Supabase query under user context]
  RLS --> Result[Allowed result only]
~~~

A redirect target is accepted only when it is an internal, allowlisted relative path. No external return URLs are honored.

### 4.5 Electron desktop session handoff

~~~mermaid
sequenceDiagram
  participant Main as Electron main
  participant Browser as System browser / Next auth
  participant SA as Supabase Auth
  participant BFF as Next BFF
  participant Vault as OS secure storage
  Main->>BFF: Create one-time desktop handoff challenge
  Main->>Browser: Open sign-in URL with challenge
  Browser->>SA: Complete email/password or Google PKCE login
  SA-->>Browser: Browser session
  Browser->>BFF: Consume authenticated handoff challenge
  BFF-->>Main: One-time, encrypted session handoff via registered deep link
  Main->>Vault: Store refresh-session material securely
  Main-->>Browser: Close/confirmation page
  Main-->>Main: Register device after session verification
  Main-->>Main: Refresh access JWT only when required
  Main-->>Main: Expose session status through narrow preload API
~~~

The renderer never receives the refresh token. The handoff challenge is single-use, short-lived, state-bound, and invalidated on cancellation. A desktop action still requires the separate Phase 1 policy/approval flow.

## 5. API architecture

### Supabase Auth interfaces

| Capability | Authority | Request origin | Result |
|---|---|---|---|
| Email sign-up/sign-in | Supabase Auth | Browser/Next auth adapter | Session or verification-required state |
| Google OAuth initiation/callback | Supabase Auth + Next callback | Browser | PKCE-protected session |
| Password reset/recovery | Supabase Auth | Browser/Next auth adapter | One-time recovery session |
| Sign-out/session revocation | Supabase Auth | Next BFF or Electron main | Local/global session invalidated |
| Token refresh | Supabase Auth SSR adapter or Electron main broker | Trusted session adapter | Rotated session cookies/token material |
| User identity/profile lookup | Auth + RLS-protected profiles | Next/Express | Verified principal and profile projection |

### JVerse endpoints

| Interface | Authentication | Responsibility | Response constraints |
|---|---|---|---|
| GET /auth/callback | OAuth code + PKCE cookie | Exchange code, establish session, validate destination | Never expose verifier/token in URL |
| POST /api/auth/sign-out | Verified cookie session | Revoke selected local/global session and clear cookies | Idempotent; redirects only internally |
| GET /api/auth/session | Verified cookie session | Return non-secret display session state | No access or refresh token payload |
| POST /api/auth/desktop-handoff | Verified browser session + one-time challenge | Consume challenge and send encrypted handoff to main | Single-use and short-lived |
| GET /v1/me | Verified bearer JWT | Return current principal/profile | User ID comes only from verified JWT subject |
| PATCH /v1/me/profile | Verified bearer JWT | Change allowed profile fields | Never changes authorization metadata |
| POST /v1/devices/register | Verified bearer JWT | Register desktop device after secure handoff | Device belongs to verified user only |
| POST /v1/devices/revoke | Verified bearer JWT | Revoke one owned device and its grants | Audit event required |

The browser can use the RLS-protected profile/settings records directly when appropriate. Sensitive profile mutation, device registration, cross-service work, and all Express use cases authenticate a verified principal. API clients never choose the user ID in the body/path as an authority value.

### JWT contract

| Claim/property | Use | Prohibited use |
|---|---|---|
| subject | Maps to Auth user, profile, and ownership references | Client-supplied substitute IDs |
| issuer/audience/expiry/signature | Required verification inputs | Decode-only acceptance |
| authentication assurance/session state | Optional policy input for sensitive flows | Assumption that stale tokens reflect current membership |
| user metadata | Display/bootstrap data only | Roles, workspace membership, or privilege decisions |
| app metadata | Future server-controlled claims only | Large workspace lists or primary authorization path |

Express verifies issuer, audience, signature/JWKS key, expiry, and subject before constructing the principal. It verifies on every protected request and never trusts a token merely because it parses. RLS remains authoritative for database rows.

## 6. Session management

### Web session policy

- Use PKCE for OAuth and SSR-compatible, secure cookie sessions.
- Cookies are Secure, HttpOnly where the framework path permits, scoped to the app, and SameSite=Lax unless a documented cross-site flow requires a narrower exception.
- Next middleware refreshes session cookies before protected rendering and redirects unauthenticated traffic to sign-in.
- Server components/routes use a server session adapter and obtain a verified user; client state treats auth events as UI hints, not authorization proof.
- Access tokens are short-lived; refresh material rotates through Supabase's supported session mechanism. Session duration and inactivity policy are configured in Supabase Auth, not duplicated in JVerse.
- Sign-out clears local cookie/session state and revokes the intended Supabase session. Account-wide sign-out is explicit.
- Password reset and email verification use single-use links with a safe internal post-completion destination.
- Rate-limit sign-in, sign-up, reset, callback, and desktop-handoff attempts. Do not disclose whether an email address exists.

### Desktop session policy

- Use the system browser plus a one-time desktop handoff, not an embedded Google webview.
- Persist refresh-session material only in OS-backed secure storage under Electron main control.
- Main process obtains/refreshes access tokens for authenticated API calls; preload exposes only current user/session status and sign-in/sign-out commands.
- Revoking a device invalidates its capability grants and removes its secure local session.
- Offline mode may display encrypted cached data only according to Phase 1; it may not mint or extend cloud authorization.

## 7. Protected-route architecture

| Route category | Examples | Enforcement |
|---|---|---|
| Public | landing, sign-in, sign-up, recovery, callback | Must redirect an already authenticated user away from sign-in only after a verified session read |
| Protected personal | dashboard, chat, settings/profile | Next middleware plus server-side session check; table RLS owner policies |
| Protected workspace | projects, knowledge | Middleware plus server/session check; workspace RLS membership policies |
| Sensitive | device management, delete account, destructive settings | Protected route plus fresh verified session; require reauthentication/step-up where product policy demands |
| Electron-only | desktop status, local model, native approvals | Protected desktop route plus successful main-process capability handshake |

Middleware is an optimization and navigation boundary, not sole authorization. Server route handlers, Express, RLS, and Electron main all perform their own relevant checks.

## 8. Component architecture

~~~text
AuthBoundary
├─ PublicAuthLayout
│  ├─ BrandPanel
│  ├─ SignInPage
│  │  ├─ GoogleSignInButton
│  │  ├─ EmailPasswordForm
│  │  ├─ AuthFeedback
│  │  └─ PasswordRecoveryLink
│  ├─ SignUpPage
│  │  ├─ GoogleSignInButton
│  │  ├─ RegistrationForm
│  │  └─ TermsConsent
│  ├─ VerificationPage
│  ├─ PasswordRecoveryPage
│  └─ AuthErrorPage
├─ SessionProvider
│  ├─ AuthenticatedAppLayout
│  │  ├─ ProfileMenu
│  │  ├─ SessionExpiryNotice
│  │  ├─ DeviceSessionIndicator
│  │  └─ ProtectedFeatureSlots
│  └─ SessionRecoveryBoundary
└─ DesktopAuthBridge
   ├─ DesktopSignInPrompt
   ├─ BrowserHandoffStatus
   └─ DeviceRegistrationStatus
~~~

Component responsibilities:

| Component | Owns | Does not own |
|---|---|---|
| EmailPasswordForm | Validation UX, submission/loading/error state | Password persistence or profile creation |
| GoogleSignInButton | Initiating the approved OAuth path | Provider secrets/callback logic |
| AuthBoundary | Rendering session state and protected UI boundary | JWT verification as the only security layer |
| ProfileMenu | Display name/avatar and user-initiated sign-out | Access token display |
| SessionExpiryNotice | Recovery prompt and unsaved-work warning | Refresh-token handling |
| DesktopAuthBridge | User-visible handoff state | Secure session storage or native IPC implementation |
| DeviceSessionIndicator | Device registration/revocation state | Capability/action authorization |

Accessibility requirements: semantic labels and autocomplete values on credential fields, keyboard-first navigation, clear but non-enumerating errors, no color-only status, focus moved to field errors, and reduced-motion-safe transitions.

## 9. Google and Supabase configuration checklist

1. Enable Email and Google providers in the Supabase Auth project.
2. Configure the Google OAuth client in Google Cloud with the Supabase Auth callback as its authorized redirect URI.
3. Configure production, preview, localhost, password-recovery, and desktop-handoff callback destinations in Supabase Auth's redirect allowlist. Do not use wildcard production origins.
4. Require email confirmation for email/password accounts before enabling protected product access, unless a documented development-only exception is active.
5. Configure Site URL, cookie domain, token lifetime, session inactivity/absolute duration, and refresh rotation in Supabase Auth.
6. Keep Google client secret, Supabase secret/service-role credentials, handoff encryption material, and webhook secrets in server/desktop secure stores only.
7. Test provider cancellation, denied consent, invalid callback, expired recovery link, duplicate email, unverified account, expired session, token revocation, and revoked desktop device.

## 10. Acceptance and security tests

| Scenario | Expected outcome |
|---|---|
| Valid email/password sign-up | One Auth identity plus exactly one profile, personal workspace, membership, and settings record |
| Duplicate sign-up | Non-enumerating response; no duplicate product records |
| Verified Google login | PKCE callback establishes a session and uses the existing profile for repeat logins |
| Unauthenticated protected request | Redirect/401 with no private render or data leak |
| Expired access JWT with valid refresh session | Session adapter refreshes safely and continues only after validation |
| Invalid/expired/replayed OAuth code | Callback fails safely; no session is established |
| Forged/tampered bearer JWT | Express rejects before any use case/database access |
| User metadata modified by client | Display data may change; permissions and workspace access do not change |
| Non-member direct database query | RLS returns no protected workspace rows |
| Electron renderer compromise | Refresh token and native authority remain unavailable |
| Revoked desktop device | Handoff/session is removed and capability grants cannot authorize future actions |
| Profile update | Only allowed profile fields for the JWT subject change |

## 11. Phase 3 handoff

Before implementation, add an ADR for the desktop handoff encryption/key lifecycle and a configuration runbook containing provider console values by environment. No schema migration is required for core web auth: Phase 2 already supplies profiles, workspace provisioning, settings, device registrations, capability grants, consents, RLS, and audit support.

Implementation must not bypass the Phase 2 profile trigger, RLS policies, or Phase 1 action-policy boundary.


# ADR-0009 — JARVIS Local Brain and Private Voice Runtime

**Status:** Accepted — 11 November 2026  
**Decision owner:** JVerse AI product architecture

## Decision

JVerse adopts this authority model:

```text
Python/FastAPI       = brain and policy-bound orchestration
Ollama/Qwen 2.5      = local intelligence
Electron main        = hands, eyes, microphone, speakers, local model bridge
Supabase             = durable memory and cloud source of truth
Whisper/Piper        = local speech-to-text and text-to-speech
Next.js              = user interface and narrow authenticated BFF
```

## Consequences

- Python owns intent routing, constrained planning, memory/RAG context assembly, tool validation, run state, and streamed response events.
- Electron main owns all local model and voice process lifecycle. Renderer code never receives raw audio, model endpoints, arbitrary IPC, or service-role credentials.
- Whisper performs local transcription from a consented microphone session. Piper synthesizes local audio from a user-approved response. Raw audio is not stored by default.
- Supabase remains authoritative for users, conversations, memories, knowledge, device registration, approval/audit state, and synchronization.
- Next.js never attempts to reach `localhost` model or voice services from a deployed browser. It talks only to the Python brain through authenticated endpoints.

## Migration

1. Define versioned Python API/event contracts equivalent to the current chat and agent contracts.
2. Move conversation, memory, RAG, intent, planning, policy, and execution use cases from the TypeScript control plane into bounded Python modules.
3. Add Electron main-process adapters for Ollama, Whisper, Piper, wake-word provider, and signed device pairing.
4. Replace the temporary localhost direct-Ollama path with an authenticated outbound Electron-to-brain pairing channel.
5. Remove the browser Web Speech production path; retain it only as a clearly labelled development fallback until Electron voice passes acceptance tests.
6. Decommission the Node/Express control-plane production deployment only after dual-run parity, security tests, streaming tests, and rollback tests pass.

## Security controls

- The Python brain verifies Supabase JWTs/workspace scope before each run.
- Tool calls are typed, allowlisted, risk-classified, approval-gated, time-bounded, and audited.
- Electron pairing is device-bound, revocable, and outbound-only; no local service is publicly exposed.
- Wake word is local-only, opt-in, visibly active, and kill-switchable.
- Voice recordings are off by default; transcript persistence occurs only after a user submits a request.

## Acceptance criteria

- A signed-in web user receives streamed Qwen responses through the Python brain and a paired Electron device.
- An offline paired desktop can run local Qwen, Whisper, and Piper without exposing a public local port.
- Memory and RAG context remain workspace-scoped and cited.
- Desktop actions require the existing approval and capability policy.
- Disabling voice, revoking a device, or losing pairing immediately removes the corresponding capability.

## Rollback

Keep the Node/Express adapter behind a feature flag during migration. If Python brain parity or pairing security fails, disable the Python route and return to the audited compatibility path; never bypass the Electron authority boundary.

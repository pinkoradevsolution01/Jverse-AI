# Phase 11 — Voice Assistant

## Runtime architecture

`ChatWorkspace` owns the visible voice controls. `VoiceControl` requests microphone access only after an explicit user click, runs browser-native speech recognition where supported, and inserts the final transcript into the chat composer. It never records or uploads raw audio.

`VoiceOrb` is a Framer Motion state indicator:

- idle — ready, no microphone use
- listening — active user-initiated recognition
- thinking — reserved for agent/model work
- speaking — browser-native text-to-speech is active
- error — recognition, permission, or synthesis failure

The Electron main process permits Chromium `media` permission solely for a trusted JVerse renderer origin. Navigation and IPC restrictions from Phase 9 remain in force.

## Audio pipeline

```text
User click → getUserMedia permission → browser-native STT
           → final transcript → chat composer → protected chat stream

Assistant Markdown → user click “read response” → speechSynthesis → local device speaker
```

No audio blob, transcript, or voice profile is sent to Supabase by the voice UI. A submitted voice transcript follows the ordinary Phase 6 chat path and is stored as a chat message under its existing RLS policy.

## Wake word

The initial implementation provides opt-in *active recognition* wake phrase detection: “Hey JVerse” or “JVerse”. It is off by default, stops with the microphone control, and does not operate while the app is closed.

An always-on offline wake-word engine requires a separately approved native provider/model asset. It must run only in Electron main process, be paired to a device registration, and expose only `wake`, `listening`, and `error` events to the renderer. It must not expose raw microphone streams through preload.

## Electron audio boundary

- Renderer: user-controlled `getUserMedia` and `speechSynthesis`.
- Main: permits `media` only from a trusted JVerse renderer.
- Preload: exposes no raw microphone, file-system, or Node capability.
- Supabase: persists text messages only after ordinary chat submission.

## UI behavior

The chat header includes the compact cyan Voice Orb, microphone toggle, optional wake-word indicator, and a “read last response” button. The design follows the Phase 4 cyan/violet SaaS theme and uses motion only to communicate live audio state.
